-- Production hardening for authenticated portfolio users.
-- Run after migrations 001, 002_admin_foundation, 002_allow_authenticated_etf_catalog_insert,
-- 003_admin_management, 004_portfolio_hidden_positions and 005_add_swda_etf.

-- The UI uses upsert() when hiding a position. Supabase requires UPDATE
-- permission and an UPDATE RLS policy for ON CONFLICT DO UPDATE.
drop policy if exists "Users can read own hidden portfolio positions" on public.portfolio_hidden_positions;
drop policy if exists "Users can hide own portfolio positions" on public.portfolio_hidden_positions;
drop policy if exists "Users can update own hidden portfolio positions" on public.portfolio_hidden_positions;
drop policy if exists "Users can restore own portfolio positions" on public.portfolio_hidden_positions;

create policy "Users can read own hidden portfolio positions"
  on public.portfolio_hidden_positions for select
  to authenticated
  using (auth.uid() = user_id and public.is_current_user_active());

create policy "Users can hide own portfolio positions"
  on public.portfolio_hidden_positions for insert
  to authenticated
  with check (auth.uid() = user_id and public.is_current_user_active());

create policy "Users can update own hidden portfolio positions"
  on public.portfolio_hidden_positions for update
  to authenticated
  using (auth.uid() = user_id and public.is_current_user_active())
  with check (auth.uid() = user_id and public.is_current_user_active());

create policy "Users can restore own portfolio positions"
  on public.portfolio_hidden_positions for delete
  to authenticated
  using (auth.uid() = user_id and public.is_current_user_active());

grant select, insert, update, delete on public.portfolio_hidden_positions to authenticated;

-- Keep the shared catalog insert feature used by the UI, but reject malformed
-- identifiers and incomplete records. Admin catalog management remains RPC-only.
drop policy if exists "etfs_insert_authenticated" on public.etfs;
create policy "etfs_insert_authenticated"
  on public.etfs for insert
  to authenticated
  with check (
    auth.uid() is not null
    and public.is_current_user_active()
    and isin ~ '^[A-Z]{2}[A-Z0-9]{10}$'
    and nullif(trim(ticker), '') is not null
    and nullif(trim(name), '') is not null
  );
