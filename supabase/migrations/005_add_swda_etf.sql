-- Add the ETF identified by the ISIN entered in the PAC screen.
-- Verified instrument: iShares Core MSCI World UCITS ETF USD (Acc).
insert into public.etfs
  (isin, ticker, name, issuer, asset_class, domicile, currency, ongoing_charges, replication, distribution_policy)
values
  ('IE00B4L5Y983', 'SWDA', 'iShares Core MSCI World UCITS ETF USD (Acc)', 'iShares', 'Equity', 'Ireland', 'USD', 0.20, 'Physical', 'Accumulating')
on conflict (isin) do update set
  ticker = excluded.ticker,
  name = excluded.name,
  issuer = excluded.issuer,
  asset_class = excluded.asset_class,
  domicile = excluded.domicile,
  currency = excluded.currency,
  ongoing_charges = excluded.ongoing_charges,
  replication = excluded.replication,
  distribution_policy = excluded.distribution_policy,
  updated_at = now();
