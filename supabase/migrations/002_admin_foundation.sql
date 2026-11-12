-- Admin foundation for Il Mio Percorso ETF.
-- Safe additive migration: does not alter portfolio transactions or ETF seed data.

alter table public.profiles
  add column if not exists email text,
  add column if not exists account_status text not null default 'active'
    check (account_status in ('active','suspended'));

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is distinct from u.email;

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','user')) default 'user',
  created_at timestamptz not null default now()
);

alter table public.user_roles enable row level security;
-- Deliberately no client policies: users cannot read or change their own role.

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles r
    where r.user_id = (select auth.uid()) and r.role = 'admin'
  );
$$;

revoke all on function public.is_current_user_admin() from public, anon;
grant execute on function public.is_current_user_admin() to authenticated;

create or replace function public.admin_dashboard_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.is_current_user_admin() then
    raise exception 'Accesso amministratore richiesto' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'total_users', (select count(*) from auth.users),
    'new_users_7d', (select count(*) from auth.users where created_at >= now() - interval '7 days'),
    'new_users_30d', (select count(*) from auth.users where created_at >= now() - interval '30 days'),
    'active_users', (select count(*) from public.profiles where account_status = 'active'),
    'suspended_users', (select count(*) from public.profiles where account_status = 'suspended'),
    'users', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'email', coalesce(p.email, ''),
        'display_name', coalesce(p.display_name, ''),
        'created_at', p.created_at,
        'account_status', p.account_status,
        'role', coalesce(r.role, 'user')
      ) order by p.created_at desc)
      from (
        select * from public.profiles order by created_at desc limit 100
      ) p
      left join public.user_roles r on r.user_id = p.id
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_dashboard_data() from public, anon;
grant execute on function public.admin_dashboard_data() to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', new.email),
    new.email
  )
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;

-- After applying this migration, grant the admin role to the owner's existing
-- Supabase Auth account from the SQL Editor using the one-time statement
-- documented in the project README. Never grant admin from browser code.
