-- Keep portfolio history intact while allowing users to hide positions from the active portfolio view.
create table if not exists public.portfolio_hidden_positions (
  user_id uuid not null references auth.users(id) on delete cascade,
  isin text not null references public.etfs(isin) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, isin)
);

alter table public.portfolio_hidden_positions enable row level security;

drop policy if exists "Users can read own hidden portfolio positions" on public.portfolio_hidden_positions;
create policy "Users can read own hidden portfolio positions"
  on public.portfolio_hidden_positions for select
  using (auth.uid() = user_id);

drop policy if exists "Users can hide own portfolio positions" on public.portfolio_hidden_positions;
create policy "Users can hide own portfolio positions"
  on public.portfolio_hidden_positions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can restore own portfolio positions" on public.portfolio_hidden_positions;
create policy "Users can restore own portfolio positions"
  on public.portfolio_hidden_positions for delete
  using (auth.uid() = user_id);

grant select, insert, delete on public.portfolio_hidden_positions to authenticated;
