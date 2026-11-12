-- Il Mio Percorso ETF: Supabase foundation
-- Apply this migration in Supabase SQL Editor before enabling cloud persistence.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.etfs (
  id uuid primary key default gen_random_uuid(),
  isin text not null unique,
  ticker text,
  name text not null,
  issuer text,
  asset_class text,
  domicile text,
  currency text,
  exchange text,
  exchange_mic text,
  ongoing_charges numeric(8,5),
  replication text,
  distribution_policy text,
  updated_at timestamptz not null default now()
);

create index if not exists etfs_ticker_idx on public.etfs (ticker);
create index if not exists etfs_name_search_idx on public.etfs using gin (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(ticker,'') || ' ' || isin));

create table if not exists public.portfolio_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  isin text not null references public.etfs(isin),
  transaction_type text not null check (transaction_type in ('buy','sell','dividend','fee')),
  quantity numeric(20,8) not null default 0 check (quantity >= 0),
  unit_price numeric(20,8) not null default 0 check (unit_price >= 0),
  fees numeric(20,8) not null default 0 check (fees >= 0),
  currency text not null default 'EUR',
  executed_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists portfolio_transactions_user_date_idx on public.portfolio_transactions(user_id, executed_at desc);

create table if not exists public.pac_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  isin text not null references public.etfs(isin),
  amount numeric(20,2) not null check (amount > 0),
  currency text not null default 'EUR',
  frequency text not null default 'monthly' check (frequency in ('weekly','monthly','quarterly')),
  day_of_month smallint check (day_of_month between 1 and 28),
  start_date date not null default current_date,
  end_date date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.watchlist (
  user_id uuid not null references auth.users(id) on delete cascade,
  isin text not null references public.etfs(isin),
  created_at timestamptz not null default now(),
  primary key (user_id, isin)
);

alter table public.profiles enable row level security;
alter table public.portfolio_transactions enable row level security;
alter table public.pac_plans enable row level security;
alter table public.watchlist enable row level security;
alter table public.etfs enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "transactions_select_own" on public.portfolio_transactions for select using (auth.uid() = user_id);
create policy "transactions_insert_own" on public.portfolio_transactions for insert with check (auth.uid() = user_id);
create policy "transactions_update_own" on public.portfolio_transactions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "transactions_delete_own" on public.portfolio_transactions for delete using (auth.uid() = user_id);
create policy "pac_select_own" on public.pac_plans for select using (auth.uid() = user_id);
create policy "pac_insert_own" on public.pac_plans for insert with check (auth.uid() = user_id);
create policy "pac_update_own" on public.pac_plans for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "pac_delete_own" on public.pac_plans for delete using (auth.uid() = user_id);
create policy "watchlist_select_own" on public.watchlist for select using (auth.uid() = user_id);
create policy "watchlist_insert_own" on public.watchlist for insert with check (auth.uid() = user_id);
create policy "watchlist_delete_own" on public.watchlist for delete using (auth.uid() = user_id);
create policy "etfs_read_all" on public.etfs for select using (true);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();
