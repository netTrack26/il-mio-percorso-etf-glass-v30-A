-- ETF look-through intelligence: shared, versioned provider snapshots.
-- Safe additive migration. Does not touch user portfolio transactions or RLS on account data.

begin;

alter table public.etfs
  add column if not exists index_name text,
  add column if not exists fund_website text,
  add column if not exists metadata_source text,
  add column if not exists metadata_as_of timestamptz,
  add column if not exists metadata_verified_at timestamptz;

create table if not exists public.etf_data_snapshots (
  id uuid primary key default gen_random_uuid(),
  isin text not null references public.etfs(isin) on delete cascade,
  provider text not null,
  provider_symbol text,
  as_of_date date not null,
  source_updated_at timestamptz,
  source_url text,
  license_note text,
  holdings_count integer not null default 0,
  holdings_coverage_percent numeric(7,4),
  created_at timestamptz not null default now(),
  unique (isin, provider, as_of_date)
);

create table if not exists public.etf_lookthrough_holdings (
  snapshot_id uuid not null references public.etf_data_snapshots(id) on delete cascade,
  security_key text not null,
  security_isin text,
  symbol text,
  security_name text not null,
  weight_percent numeric(12,8) not null check (weight_percent >= 0 and weight_percent <= 100),
  sector text,
  country text,
  asset_type text,
  primary key (snapshot_id, security_key)
);

create table if not exists public.etf_country_allocations (
  snapshot_id uuid not null references public.etf_data_snapshots(id) on delete cascade,
  country text not null,
  weight_percent numeric(12,8) not null check (weight_percent >= 0 and weight_percent <= 100),
  primary key (snapshot_id, country)
);

create table if not exists public.etf_sector_allocations (
  snapshot_id uuid not null references public.etf_data_snapshots(id) on delete cascade,
  sector text not null,
  weight_percent numeric(12,8) not null check (weight_percent >= 0 and weight_percent <= 100),
  primary key (snapshot_id, sector)
);

create index if not exists etf_data_snapshots_latest_idx
  on public.etf_data_snapshots (isin, as_of_date desc, created_at desc);
create index if not exists etf_lookthrough_security_idx
  on public.etf_lookthrough_holdings (security_key);
create index if not exists etf_lookthrough_isin_idx
  on public.etf_lookthrough_holdings (security_isin);

alter table public.etf_data_snapshots enable row level security;
alter table public.etf_lookthrough_holdings enable row level security;
alter table public.etf_country_allocations enable row level security;
alter table public.etf_sector_allocations enable row level security;

drop policy if exists etf_snapshots_read_authenticated on public.etf_data_snapshots;
create policy etf_snapshots_read_authenticated on public.etf_data_snapshots
  for select to authenticated using (public.is_current_user_active());
drop policy if exists etf_lookthrough_read_authenticated on public.etf_lookthrough_holdings;
create policy etf_lookthrough_read_authenticated on public.etf_lookthrough_holdings
  for select to authenticated using (public.is_current_user_active());
drop policy if exists etf_country_read_authenticated on public.etf_country_allocations;
create policy etf_country_read_authenticated on public.etf_country_allocations
  for select to authenticated using (public.is_current_user_active());
drop policy if exists etf_sector_read_authenticated on public.etf_sector_allocations;
create policy etf_sector_read_authenticated on public.etf_sector_allocations
  for select to authenticated using (public.is_current_user_active());

grant select on public.etf_data_snapshots, public.etf_lookthrough_holdings,
  public.etf_country_allocations, public.etf_sector_allocations to authenticated;

commit;
