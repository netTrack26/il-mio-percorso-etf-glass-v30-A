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
