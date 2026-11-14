-- Allow signed-in users to add ETF identifiers to the shared searchable catalog.
-- No price feed or issuer data is implied by this metadata-only entry.
drop policy if exists "etfs_insert_authenticated" on public.etfs;
create policy "etfs_insert_authenticated"
on public.etfs
for insert
to authenticated
with check (auth.uid() is not null);
