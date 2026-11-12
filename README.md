# Il Mio Percorso ETF — Glass V30

Next.js 15 / React 19. La UI demo resta funzionante in locale tramite localStorage finché non vengono configurate le credenziali Supabase.

## Supabase — base dati
1. Crea un progetto Supabase.
2. Apri SQL Editor ed esegui `supabase/migrations/001_initial_schema.sql`.
3. Inserisci Project URL e anon/publishable key nelle variabili Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Ridistribuisci il progetto.

La migrazione crea profili, catalogo ETF, transazioni, piani PAC e watchlist. Le tabelle personali sono protette con Row Level Security: ogni utente può leggere e modificare soltanto i propri dati. Il catalogo ETF è leggibile pubblicamente.

## Stato e limiti
- La UI V30 resta una demo locale; non invia ordini e non esegue acquisti automatici.
- I piani PAC sono configurazioni/promemoria, non ordini di investimento.
- Le quotazioni di mercato richiedono un provider e i relativi diritti/API key.
- Non inserire mai una service-role key nel browser o in variabili `NEXT_PUBLIC_*`.
- La sincronizzazione cloud e l'autenticazione verranno collegate dopo la configurazione del progetto Supabase.


## Area amministratore — attivazione iniziale
1. Dopo la migrazione iniziale, esegui anche `supabase/migrations/002_admin_foundation.sql` dal SQL Editor di Supabase.
2. Per assegnare il ruolo amministratore al tuo account già registrato, sostituisci l'indirizzo qui sotto con la stessa email usata per accedere alla piattaforma ed esegui una sola volta:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin'
from auth.users
where lower(email) = lower('memu86@hotmail.it')
on conflict (user_id) do update set role = 'admin';
```

La tabella dei ruoli non è accessibile direttamente dal browser. Le funzioni amministrative verificano il ruolo nel database e negano l'accesso agli utenti normali. Non assegnare il ruolo admin ad altri account se non sono amministratori fidati.


## Area amministratore completa — aggiornamento 003
Dopo aver già applicato le migrazioni 001 e 002 e assegnato il ruolo proprietario, esegui una sola volta `supabase/migrations/003_admin_management.sql` nel SQL Editor di Supabase.

La migrazione aggiunge:
- statistiche e grafico iscrizioni giornaliere;
- ricerca utenti e funzioni protette per sospendere/riattivare account e cambiare ruolo;
- gestione del catalogo ETF tramite funzioni amministrative, con protezione contro la cancellazione di ETF già usati da portafogli, PAC o watchlist;
- impostazioni di presentazione Premium;
- blocco tramite Row Level Security dell'accesso ai dati personali agli account sospesi.

Le operazioni amministrative sono funzioni SQL `SECURITY DEFINER` che verificano il ruolo admin nel database. Non richiedono né espongono la service-role key nel browser. La sospensione non cancella account, transazioni o posizioni.

Premium resta una predisposizione di prodotto: questa versione non gestisce pagamenti, abbonamenti, fatture o concessione automatica di privilegi Premium. Prima di distribuire dati ETF agli utenti occorre verificare la licenza commerciale del provider.
