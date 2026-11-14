# Il Mio Percorso ETF — Glass V30

Next.js 15 / React 19. La piattaforma richiede Supabase configurato: senza credenziali la UI non è un ambiente multiutente e non deve essere presentata come servizio pubblico.

## Stato del database esistente

Il progetto Supabase esistente è già popolato: risultano presenti le tabelle `etfs`, `pac_plans`, `portfolio_hidden_positions`, `portfolio_transactions`, `profiles`, `user_roles` e `watchlist`. Non è stato trovato il registro standard `supabase_migrations.schema_migrations`: non applicare nuovamente in blocco le migrazioni iniziali.

Per riallineare il database esistente, dopo aver confermato la presenza delle tabelle base, applica **una sola volta** il file:

`supabase/migrations/007_reconcile_existing_supabase.sql`

La migrazione è transazionale e ripetibile. Non elimina né riscrive le operazioni del portafoglio. Crea le RPC amministrative mancanti e `platform_settings`, aggiorna il trigger di signup con `search_path` vuoto, applica le policy RLS per account attivi, aggiunge l'UPDATE necessario all'upsert delle posizioni nascoste, disabilita l'inserimento diretto non verificato nel catalogo e aggiunge SWDA solo se non è già presente. Se una tabella/colonna prerequisita non è presente, la transazione fallisce senza lasciare una migrazione applicata a metà.

Non eseguire 003, 005 o 006 separatamente dopo 007. Non creare manualmente una tabella `schema_migrations` solo per far apparire una cronologia.

## Installazione per un progetto Supabase completamente nuovo

Solo per un progetto vuoto, esegui in ordine:
1. `001_initial_schema.sql`
2. `002_admin_foundation.sql`
3. `007_reconcile_existing_supabase.sql`

La migrazione 007 include le funzioni amministrative, le policy di sicurezza e la tabella delle posizioni nascoste; non eseguire le vecchie migrazioni 002_allow, 003, 004, 005 e 006 in questa procedura.

## Variabili Vercel

Configura almeno:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — solo server, necessaria all'API di ricerca/salvataggio ETF e all'invio degli inviti Beta
- `BETA_INVITE_CODE` — codice condiviso con il gruppo Telegram; solo server, mai usare il prefisso `NEXT_PUBLIC_`
- `OPENAI_API_KEY` — solo server, necessaria per l'analisi AI

Facoltativa:
- `OPENAI_ANALYSIS_MODEL` — se assente viene usato il modello predefinito configurato nel codice.

Non inserire mai service-role key o OpenAI API key in variabili `NEXT_PUBLIC_*`, nel browser, nel repository o in screenshot. Dopo aver impostato le variabili, esegui un nuovo deployment.

### Attivazione inviti Beta

- In Supabase Auth disattiva le registrazioni pubbliche (Enable Sign Ups) prima di condividere il link. Gli account Beta vengono creati dall'endpoint server `/api/beta-invite` solo dopo la verifica del codice condiviso.
- In Supabase Auth > URL Configuration aggiungi come Redirect URL `https://TUO-DOMINIO/auth/callback` (e il dominio Preview Vercel se userai le preview).
- Imposta `BETA_INVITE_CODE` in Vercel con il codice comunicato agli invitati e `SUPABASE_SERVICE_ROLE_KEY` come variabile server. Non inserirli nel client o nel repository.
- Il link pubblico da condividere è `https://TUO-DOMINIO/?invite=CODICE_CONDIVISO`. Il link precompila il codice e apre la registrazione; l'utente riceve poi un'email Supabase per attivare l'account e impostare la password.
- La chiave service role non deve mai essere condivisa. Il codice comune può essere inoltrato: non prova l'appartenenza al gruppo Telegram.

## Primo amministratore

Dopo aver creato il tuo account tramite la pagina di registrazione, assegna il ruolo amministratore una sola volta dal SQL Editor. Sostituisci l'indirizzo segnaposto con l'email esatta del tuo account:

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
- La migrazione 007 non sostituisce un audit esterno. Prima delle iscrizioni pubbliche servono test con due account distinti, recupero password, cancellazione dati, rate limiting API, privacy policy, termini d'uso e verifica delle licenze delle fonti dati.
