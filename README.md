# Il Mio Percorso ETF — Glass V30

Next.js 15 / React 19. La piattaforma richiede Supabase configurato: senza credenziali la UI non è un ambiente multiutente e non deve essere presentata come servizio pubblico.

## Installazione Supabase — ordine obbligatorio

Crea un progetto Supabase e apri **SQL Editor**. Esegui una sola volta, nell'ordine indicato, tutti i file SQL:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_admin_foundation.sql`
3. `supabase/migrations/002_allow_authenticated_etf_catalog_insert.sql`
4. `supabase/migrations/003_admin_management.sql`
5. `supabase/migrations/004_portfolio_hidden_positions.sql`
6. `supabase/migrations/005_add_swda_etf.sql`
7. `supabase/migrations/006_production_hardening.sql`

Non saltare le migrazioni: la dashboard legge anche `portfolio_hidden_positions`; la migrazione 006 aggiunge la policy UPDATE richiesta dall'operazione `upsert` e applica controlli di validità agli inserimenti nel catalogo condiviso.

## Variabili Vercel

Configura almeno:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — solo server, necessaria all'API di ricerca/salvataggio ETF
- `OPENAI_API_KEY` — solo server, necessaria per l'analisi AI

Facoltativa:

- `OPENAI_ANALYSIS_MODEL` — se assente viene usato il modello predefinito configurato nel codice.

Non inserire mai service-role key o OpenAI API key in variabili `NEXT_PUBLIC_*`, nel browser, nel repository o in screenshot. Dopo aver impostato le variabili, esegui un nuovo deployment.

## Primo amministratore

Dopo aver creato il tuo account tramite la pagina di registrazione e aver applicato la migrazione 002_admin_foundation, assegna il ruolo amministratore una sola volta dal SQL Editor. Sostituisci l'indirizzo segnaposto con l'email esatta del tuo account:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin'
from auth.users
where lower(email) = lower('INSERISCI-LA-TUA-EMAIL')
on conflict (user_id) do update set role = 'admin';
```

Non assegnare il ruolo admin ad altri account se non sono amministratori fidati. Le funzioni amministrative verificano il ruolo nel database; non assegnare ruoli tramite codice client.

## Funzioni e limiti attuali

- Il portafoglio registra movimenti inseriti dall'utente; non invia ordini e non esegue acquisti automatici.
- I piani PAC sono configurazioni/promemoria, non ordini di investimento.
- Le quotazioni sono recuperate da Yahoo Finance e i cambi storici da Frankfurter. Non sono prezzi certificati; prima della distribuzione commerciale occorre verificare licenze, condizioni d'uso, copertura e tempi di aggiornamento.
- L'analisi AI è informativa e non costituisce consulenza finanziaria personalizzata. Senza archivio aggiornato delle partecipazioni sottostanti non può calcolare in modo affidabile overlap, pesi geografici o settoriali aggregati.
- Premium è una predisposizione grafica/amministrativa: questa versione non gestisce pagamenti, abbonamenti o fatturazione.
- Le tabelle personali sono protette da Row Level Security. Prima di aprire le iscrizioni al pubblico, eseguire i test di isolamento tra due account, sospensione account, registrazione, recupero password e cancellazione dati.
- Non pubblicare il servizio finché non sono configurati e verificati privacy policy, termini d'uso, processo di cancellazione account, protezioni anti-abuso e licenze dei dati di mercato.
