# Il Mio Percorso ETF — Glass V30

Next.js 15 / React 19. La piattaforma richiede Supabase configurato: senza credenziali la UI non è un ambiente multiutente e non deve essere presentata come servizio pubblico.

## Stato del database esistente

Il progetto Supabase esistente è già popolato: risultano presenti le tabelle `etfs`, `pac_plans`, `portfolio_hidden_positions`, `portfolio_transactions`, `profiles`, `user_roles` e `watchlist`. Non applicare nuovamente le migrazioni iniziali 001–006 in blocco: il database non ha un registro standard di migrazione identificato e gli oggetti sono stati creati in precedenza senza una cronologia verificabile.

Per riallineare il database esistente, dopo aver verificato che le tabelle base sopra elencate siano presenti, applica **una sola volta** il file:

`supabase/migrations/007_reconcile_existing_supabase.sql`

La migrazione è pensata per essere ripetibile: usa `CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, rimozione/ricreazione delle sole policy nominate e `INSERT ... ON CONFLICT DO NOTHING` per SWDA. Non elimina né riscrive le operazioni del portafoglio. Crea le RPC amministrative mancanti, crea `platform_settings`, aggiorna il trigger di signup con `search_path` vuoto, applica le policy RLS per account attivi e aggiunge la policy UPDATE necessaria all'upsert delle posizioni nascoste. Rimuove l'inserimento diretto non verificato nel catalogo: gli ETF vengono inseriti dal server dopo la verifica dell'ISIN.

Non eseguire 003, 005 o 006 separatamente dopo 007: sono già ricompresi nella riconciliazione. Non creare manualmente una tabella `schema_migrations` solo per far apparire una cronologia.

## Installazione Supabase per un progetto nuovo

Solo per un progetto Supabase completamente nuovo, senza alcuna delle tabelle base, eseguire in ordine:
1. `001_initial_schema.sql`
2. `002_admin_foundation.sql`
3. `002_allow_authenticated_etf_catalog_insert.sql`
4. `003_admin_management.sql`
5. `004_portfolio_hidden_positions.sql`
6. `005_add_swda_etf.sql`
7. `006_production_hardening.sql`

Non usare questa procedura su un database già popolato.

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

Se il ruolo amministratore è già presente, non eseguire nuovamente l'assegnazione.

## Funzioni e limiti attuali

- Il portafoglio registra movimenti inseriti dall'utente; non invia ordini e non esegue acquisti automatici.
- I piani PAC sono configurazioni/promemoria, non ordini di investimento.
- Le quotazioni sono recuperate da Yahoo Finance e i cambi storici da Frankfurter. Non sono prezzi certificati; prima della distribuzione commerciale occorre verificare licenze, condizioni d'uso, copertura e tempi di aggiornamento.
- L'analisi AI è informativa e non costituisce consulenza finanziaria personalizzata. Senza archivio aggiornato delle partecipazioni sottostanti non può calcolare in modo affidabile overlap, pesi geografici o settoriali aggregati.
- Premium è una predisposizione grafica/amministrativa: questa versione non gestisce pagamenti, abbonamenti o fatturazione.
- La migrazione 007 non sostituisce un audit esterno di sicurezza. Prima delle iscrizioni pubbliche servono test con due account distinti, recupero password, cancellazione dati, rate limiting API, privacy policy, termini d'uso e verifica licenze delle fonti dati.
