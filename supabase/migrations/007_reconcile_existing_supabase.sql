-- Il Mio Percorso ETF: reconcile an existing Supabase project safely.
-- Apply ONLY after the existing base tables have been confirmed.
-- Idempotent: can be re-run. No DROP TABLE, TRUNCATE, DELETE or portfolio-data rewrite.
-- Adds missing admin objects, tightens per-user RLS, fixes hidden-position upsert,
-- and seeds SWDA only when the ISIN is not already present.

begin;

-- Required by admin RPCs. Existing rows (if any) are preserved.
create table if not exists public.platform_settings (
  setting_key text primary key,
  setting_value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.platform_settings enable row level security;

-- Active account predicate used by the account-owned table policies.
create or replace function public.is_current_user_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.account_status = 'active'
  );
$$;
revoke all on function public.is_current_user_active() from public, anon;
grant execute on function public.is_current_user_active() to authenticated;

-- Keep profiles accessible only to their own active account.
alter table public.profiles enable row level security;
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated
using (auth.uid() = id and public.is_current_user_active());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
using (auth.uid() = id and public.is_current_user_active())
with check (auth.uid() = id and public.is_current_user_active());
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert to authenticated
with check (auth.uid() = id and public.is_current_user_active());

-- Portfolio movements: users can access only their own active-account rows.
alter table public.portfolio_transactions enable row level security;
drop policy if exists transactions_select_own on public.portfolio_transactions;
create policy transactions_select_own on public.portfolio_transactions for select to authenticated
using (auth.uid() = user_id and public.is_current_user_active());
drop policy if exists transactions_insert_own on public.portfolio_transactions;
create policy transactions_insert_own on public.portfolio_transactions for insert to authenticated
with check (auth.uid() = user_id and public.is_current_user_active());
drop policy if exists transactions_update_own on public.portfolio_transactions;
create policy transactions_update_own on public.portfolio_transactions for update to authenticated
using (auth.uid() = user_id and public.is_current_user_active())
with check (auth.uid() = user_id and public.is_current_user_active());
drop policy if exists transactions_delete_own on public.portfolio_transactions;
create policy transactions_delete_own on public.portfolio_transactions for delete to authenticated
using (auth.uid() = user_id and public.is_current_user_active());

-- PAC plans: users can access only their own active-account rows.
alter table public.pac_plans enable row level security;
drop policy if exists pac_select_own on public.pac_plans;
create policy pac_select_own on public.pac_plans for select to authenticated
using (auth.uid() = user_id and public.is_current_user_active());
drop policy if exists pac_insert_own on public.pac_plans;
create policy pac_insert_own on public.pac_plans for insert to authenticated
with check (auth.uid() = user_id and public.is_current_user_active());
drop policy if exists pac_update_own on public.pac_plans;
create policy pac_update_own on public.pac_plans for update to authenticated
using (auth.uid() = user_id and public.is_current_user_active())
with check (auth.uid() = user_id and public.is_current_user_active());
drop policy if exists pac_delete_own on public.pac_plans;
create policy pac_delete_own on public.pac_plans for delete to authenticated
using (auth.uid() = user_id and public.is_current_user_active());

-- Watchlist: users can access only their own active-account rows.
alter table public.watchlist enable row level security;
drop policy if exists watchlist_select_own on public.watchlist;
create policy watchlist_select_own on public.watchlist for select to authenticated
using (auth.uid() = user_id and public.is_current_user_active());
drop policy if exists watchlist_insert_own on public.watchlist;
create policy watchlist_insert_own on public.watchlist for insert to authenticated
with check (auth.uid() = user_id and public.is_current_user_active());
drop policy if exists watchlist_delete_own on public.watchlist;
create policy watchlist_delete_own on public.watchlist for delete to authenticated
using (auth.uid() = user_id and public.is_current_user_active());

-- Hidden positions: the frontend uses upsert(), so UPDATE permission/policy
-- is required on conflict. Scope every operation to the owner and active account.
create table if not exists public.portfolio_hidden_positions (
  user_id uuid not null references auth.users(id) on delete cascade,
  isin text not null references public.etfs(isin) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, isin)
);
alter table public.portfolio_hidden_positions enable row level security;
drop policy if exists "Users can read own hidden portfolio positions" on public.portfolio_hidden_positions;
drop policy if exists "Users can hide own portfolio positions" on public.portfolio_hidden_positions;
drop policy if exists "Users can update own hidden portfolio positions" on public.portfolio_hidden_positions;
drop policy if exists "Users can restore own portfolio positions" on public.portfolio_hidden_positions;
create policy "Users can read own hidden portfolio positions"
  on public.portfolio_hidden_positions for select to authenticated
  using (auth.uid() = user_id and public.is_current_user_active());
create policy "Users can hide own portfolio positions"
  on public.portfolio_hidden_positions for insert to authenticated
  with check (auth.uid() = user_id and public.is_current_user_active());
create policy "Users can update own hidden portfolio positions"
  on public.portfolio_hidden_positions for update to authenticated
  using (auth.uid() = user_id and public.is_current_user_active())
  with check (auth.uid() = user_id and public.is_current_user_active());
create policy "Users can restore own hidden portfolio positions"
  on public.portfolio_hidden_positions for delete to authenticated
  using (auth.uid() = user_id and public.is_current_user_active());
grant select, insert, update, delete on public.portfolio_hidden_positions to authenticated;

-- Do not allow arbitrary clients to insert unverified shared ETF data.
-- Verified ETF discovery is handled by /api/etf-search using the server-only service key.
alter table public.etfs enable row level security;
drop policy if exists "etfs_insert_authenticated" on public.etfs;

-- Re-create the role check with an empty search_path and qualified references.
create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles r
    where r.user_id = (select auth.uid())
      and r.role = 'admin'
  );
$$;
revoke all on function public.is_current_user_admin() from public, anon;
grant execute on function public.is_current_user_admin() to authenticated;

-- Secure signup trigger: do not rely on an attacker-controlled search_path.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', new.email),
    new.email
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Restore the admin RPC functions that are absent in the live project.
create or replace function public.admin_dashboard_data()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare result jsonb;
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
        'id', p.id, 'email', coalesce(p.email, ''),
        'display_name', coalesce(p.display_name, ''),
        'created_at', p.created_at, 'account_status', p.account_status,
        'role', coalesce(r.role, 'user')
      ) order by p.created_at desc)
      from (select * from public.profiles order by created_at desc limit 500) p
      left join public.user_roles r on r.user_id = p.id
    ), '[]'::jsonb),
    'signups_30d', coalesce((
      select jsonb_agg(jsonb_build_object('day', d.day::text, 'count', d.cnt) order by d.day)
      from (
        select day::date as day, count(u.id)::int as cnt
        from generate_series(current_date - 29, current_date, interval '1 day') day
        left join auth.users u on u.created_at >= day and u.created_at < day + interval '1 day'
        group by day::date
      ) d
    ), '[]'::jsonb),
    'catalog', coalesce((
      select jsonb_agg(jsonb_build_object(
        'isin', e.isin, 'ticker', coalesce(e.ticker,''), 'name', e.name,
        'issuer', coalesce(e.issuer,''), 'currency', coalesce(e.currency,''),
        'ongoing_charges', e.ongoing_charges
      ) order by e.ticker nulls last, e.name)
      from (select * from public.etfs order by ticker nulls last, name limit 500) e
    ), '[]'::jsonb),
    'premium', coalesce((
      select setting_value from public.platform_settings where setting_key = 'premium'
    ), '{"enabled":false,"label":"In arrivo","description":"Funzioni avanzate in preparazione"}'::jsonb)
  ) into result;
  return result;
end;
$$;

create or replace function public.admin_set_user_status(target_user uuid, new_status text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_current_user_admin() then
    raise exception 'Accesso amministratore richiesto' using errcode = '42501';
  end if;
  if new_status not in ('active','suspended') then
    raise exception 'Stato non valido';
  end if;
  if target_user = (select auth.uid()) and new_status = 'suspended' then
    raise exception 'Non puoi sospendere il tuo account';
  end if;
  update public.profiles set account_status = new_status, updated_at = now()
  where id = target_user;
  if not found then raise exception 'Utente non trovato'; end if;
end;
$$;

create or replace function public.admin_set_user_role(target_user uuid, new_role text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_current_user_admin() then
    raise exception 'Accesso amministratore richiesto' using errcode = '42501';
  end if;
  if new_role not in ('admin','user') then raise exception 'Ruolo non valido'; end if;
  if target_user = (select auth.uid()) and new_role <> 'admin' then
    raise exception 'Non puoi rimuovere il ruolo al tuo account proprietario';
  end if;
  if new_role = 'user' and exists (
    select 1 from public.user_roles where user_id = target_user and role = 'admin'
  ) and (select count(*) from public.user_roles where role = 'admin') <= 1 then
    raise exception 'Deve rimanere almeno un amministratore';
  end if;
  insert into public.user_roles(user_id, role) values(target_user,new_role)
  on conflict(user_id) do update set role = excluded.role;
end;
$$;

create or replace function public.admin_upsert_etf(
  p_isin text, p_ticker text, p_name text, p_issuer text default null,
  p_currency text default null, p_ter numeric default null
)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_current_user_admin() then
    raise exception 'Accesso amministratore richiesto' using errcode = '42501';
  end if;
  if p_isin !~ '^[A-Z]{2}[A-Z0-9]{10}$' or length(trim(p_ticker)) = 0 or length(trim(p_name)) = 0 then
    raise exception 'ISIN, ticker e nome sono obbligatori e devono essere validi';
  end if;
  insert into public.etfs(isin,ticker,name,issuer,currency,ongoing_charges,updated_at)
  values(upper(trim(p_isin)),upper(trim(p_ticker)),trim(p_name),nullif(trim(p_issuer),''),
    nullif(trim(p_currency),''),p_ter,now())
  on conflict(isin) do update set ticker=excluded.ticker,name=excluded.name,
    issuer=excluded.issuer,currency=excluded.currency,
    ongoing_charges=excluded.ongoing_charges,updated_at=now();
end;
$$;

create or replace function public.admin_delete_etf(p_isin text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_current_user_admin() then
    raise exception 'Accesso amministratore richiesto' using errcode = '42501';
  end if;
  if exists(select 1 from public.portfolio_transactions where isin = p_isin)
     or exists(select 1 from public.pac_plans where isin = p_isin)
     or exists(select 1 from public.watchlist where isin = p_isin) then
    raise exception 'ETF utilizzato da utenti: non è possibile eliminarlo. Puoi modificarne i dati.';
  end if;
  delete from public.etfs where isin = p_isin;
end;
$$;

create or replace function public.admin_set_premium(p_enabled boolean, p_label text, p_description text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_current_user_admin() then
    raise exception 'Accesso amministratore richiesto' using errcode = '42501';
  end if;
  insert into public.platform_settings(setting_key,setting_value,updated_at)
  values('premium',jsonb_build_object('enabled',p_enabled,'label',left(p_label,40),'description',left(p_description,240)),now())
  on conflict(setting_key) do update set setting_value=excluded.setting_value,updated_at=now();
end;
$$;

revoke all on function public.admin_dashboard_data() from public, anon;
revoke all on function public.admin_set_user_status(uuid,text) from public, anon;
revoke all on function public.admin_set_user_role(uuid,text) from public, anon;
revoke all on function public.admin_upsert_etf(text,text,text,text,text,numeric) from public, anon;
revoke all on function public.admin_delete_etf(text) from public, anon;
revoke all on function public.admin_set_premium(boolean,text,text) from public, anon;
grant execute on function public.admin_dashboard_data() to authenticated;
grant execute on function public.admin_set_user_status(uuid,text) to authenticated;
grant execute on function public.admin_set_user_role(uuid,text) to authenticated;
grant execute on function public.admin_upsert_etf(text,text,text,text,text,numeric) to authenticated;
grant execute on function public.admin_delete_etf(text) to authenticated;
grant execute on function public.admin_set_premium(boolean,text,text) to authenticated;


-- Add SWDA only when it is not already in the shared catalog.
-- Existing manually enriched metadata is intentionally not overwritten.
insert into public.etfs
  (isin, ticker, name, issuer, asset_class, domicile, currency, ongoing_charges, replication, distribution_policy)
values
  ('IE00B4L5Y983', 'SWDA', 'iShares Core MSCI World UCITS ETF USD (Acc)', 'iShares', 'Equity', 'Ireland', 'USD', 0.20, 'Physical', 'Accumulating')
on conflict (isin) do nothing;

commit;
