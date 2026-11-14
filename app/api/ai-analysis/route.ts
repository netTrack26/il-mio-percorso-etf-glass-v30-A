import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { fetchYahooChart } from "../../../lib/yahoo-finance";

export const runtime = "nodejs";

async function getSessionClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Configurazione Supabase mancante.");
  const store = await cookies();
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        try { values.forEach(({ name, value, options }) => store.set(name, value, options)); } catch {}
      }
    }
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { supabase, user: data.user };
}

type Holding = { isin: string; ticker: string; name: string; quantity: number; invested: number; currentValue: number; weight: number; pnl: number; quote: { source: string; symbol: string; time: string | null; marketState: string; freshness: "fresh" | "delayed" | "unavailable" } | null; };

function localInsights(holdings: Holding[], total: number, invested: number, pacMonthly: number) {
  const top = [...holdings].sort((a,b)=>b.weight-a.weight)[0];
  const pnl = total - invested;
  const notes: string[] = [];
  if (holdings.length === 1) notes.push("Il portafoglio contiene un solo ETF: la diversificazione tra strumenti è quindi limitata. La diversificazione interna dipende dai titoli effettivamente detenuti dall'ETF.");
  else if (holdings.length > 1) notes.push("Il portafoglio è distribuito su " + holdings.length + " ETF. Il numero di strumenti, da solo, non dimostra una diversificazione effettiva: occorre confrontare indici e componenti.");
  if (top && top.weight >= 70) notes.push(top.ticker + " rappresenta circa il " + top.weight.toFixed(1) + "% del valore: valuta la concentrazione rispetto al tuo obiettivo e alla tua tolleranza al rischio.");
  if (invested > 0) notes.push("Il risultato rispetto al costo medio registrato è " + (pnl >= 0 ? "positivo di " : "negativo di ") + Math.abs(pnl).toFixed(2) + " euro (" + ((pnl/invested)*100).toFixed(2) + "%). È una fotografia basata sui prezzi disponibili, non un rendimento storico certificato.");
  if (pacMonthly > 0) notes.push("I piani PAC attivi ammontano complessivamente a " + pacMonthly.toFixed(2) + " euro al mese equivalente. Verifica che il totale sia sostenibile rispetto alla liquidità disponibile.");
  if (!holdings.length) notes.push("Non risultano posizioni attive ricostruibili dai movimenti. Registra un acquisto per ricevere un'analisi del portafoglio.");
  return notes;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionClient();
    if (!session) return NextResponse.json({ error: "Accedi per utilizzare AI Analysis." }, { status: 401 });
    const { supabase, user } = session;
    const body = await request.json().catch(() => ({}));
    const currentPrices = new Map<string, number>((Array.isArray(body.currentPrices) ? body.currentPrices : []).slice(0, 50).filter((x:any)=>typeof x?.isin==="string" && Number.isFinite(Number(x.price)) && Number(x.price)>0).map((x:any)=>[String(x.isin).toUpperCase(), Number(x.price)]));
    const [{ data: rows, error: txError }, { data: pacRows, error: pacError }] = await Promise.all([
      supabase.from("portfolio_transactions").select("isin,transaction_type,quantity,unit_price,fees,executed_at,etfs(ticker,name)").eq("user_id", user.id).order("executed_at", { ascending: true }),
      supabase.from("pac_plans").select("amount,frequency,active").eq("user_id", user.id)
    ]);
    if (txError) throw new Error("Lettura movimenti non riuscita: " + txError.message);
    if (pacError) throw new Error("Lettura piani PAC non riuscita: " + pacError.message);

    const map = new Map<string, { ticker:string; name:string; quantity:number; cost:number }>();
    for (const row of rows || []) {
      const relation = Array.isArray(row.etfs) ? row.etfs[0] : row.etfs;
      const isin = String(row.isin || "");
      const current = map.get(isin) || { ticker:String(relation?.ticker || isin), name:String(relation?.name || isin), quantity:0, cost:0 };
      const qty = Math.max(0, Number(row.quantity) || 0);
      const price = Math.max(0, Number(row.unit_price) || 0);
      const fees = Math.max(0, Number(row.fees) || 0);
      if (row.transaction_type === "buy") { current.cost += qty * price + fees; current.quantity += qty; }
      else if (row.transaction_type === "sell" && current.quantity > 0) {
        const average = current.cost / current.quantity;
        const sold = Math.min(qty, current.quantity);
        current.quantity -= sold;
        current.cost = Math.max(0, current.cost - average * sold);
      }
      map.set(isin, current);
    }

    const holdings: Holding[] = [...map.entries()].filter(([,v])=>v.quantity>0).map(([isin,v])=>({
      isin, ticker:v.ticker, name:v.name, quantity:Number(v.quantity.toFixed(6)), invested:Number(v.cost.toFixed(2)),
      currentValue:Number((v.cost).toFixed(2)), weight:0, pnl:0, quote:null
    }));
    const isins = holdings.map(h=>h.isin);
    if (isins.length) {
      const { data: instruments, error: catalogError } = await supabase.from("etfs").select("isin,ticker,exchange,currency").in("isin", isins);
      if (catalogError) throw new Error("Verifica quotazioni non riuscita: " + catalogError.message);
      const byIsin = new Map<string, any>((instruments || []).map((item:any)=>[String(item.isin).toUpperCase(), item]));
      await Promise.all(holdings.map(async holding => {
        const instrument = byIsin.get(holding.isin.toUpperCase());
        if (!instrument) return;
        try {
          const quote = await fetchYahooChart(instrument, "5d", "1d");
          const quoteMillis = quote.quoteTime ? new Date(quote.quoteTime).getTime() : 0;
          const ageHours = quoteMillis > 0 ? (Date.now() - quoteMillis) / 3600000 : Infinity;
          const freshness = ageHours <= 36 ? "fresh" : "delayed";
          holding.currentValue = Number((holding.quantity * quote.price).toFixed(2));
          holding.quote = { source:"Yahoo Finance", symbol:quote.symbol, time:quote.quoteTime, marketState:quote.marketState, freshness };
        } catch {
          holding.quote = { source:"Yahoo Finance", symbol:String(instrument.ticker || holding.ticker), time:null, marketState:"UNAVAILABLE", freshness:"unavailable" };
        }
      }));
    }
    const invested = holdings.reduce((s,h)=>s+h.invested,0);
    const total = holdings.reduce((s,h)=>s+h.currentValue,0);
    for (const h of holdings) { h.weight = total > 0 ? h.currentValue / total * 100 : 0; h.pnl = h.currentValue - h.invested; }
    const pacMonthly = (pacRows || []).filter((p:any)=>p.active).reduce((sum:number,p:any)=>sum + (Number(p.amount)||0) * (p.frequency==="weekly"?52/12:p.frequency==="quarterly"?1/3:1),0);
    const liveQuoteCount = holdings.filter(h=>h.quote?.freshness==="fresh").length;
    const delayedQuoteCount = holdings.filter(h=>h.quote?.freshness==="delayed").length;
    const unavailableQuoteCount = holdings.filter(h=>h.quote?.freshness==="unavailable" || !h.quote).length;
    const facts = {
      currency:"EUR", holdings, invested: Number(invested.toFixed(2)), currentValue: Number(total.toFixed(2)),
      unrealizedResult: Number((total-invested).toFixed(2)), hasLiveQuotes: liveQuoteCount>0, liveQuoteCount, delayedQuoteCount, unavailableQuoteCount,
      quoteCoveragePercent: holdings.length ? Number((liveQuoteCount/holdings.length*100).toFixed(1)) : 0, activePacMonthlyEquivalent: Number(pacMonthly.toFixed(2)),
      dataLimitations: "Le quotazioni sono richieste direttamente a Yahoo Finance durante questa analisi. Fresca significa timestamp entro 36 ore, non certificazione o licenza del dato; ritardata significa timestamp più vecchio. Se la richiesta fallisce si usa il costo medio registrato come valore sostitutivo e la posizione è marcata non disponibile. Non inventare overlap o composizione sottostante."
    };
    const deterministic = localInsights(holdings, total, invested, pacMonthly);
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ mode:"rules", generatedAt:new Date().toISOString(), facts, summary:"Analisi automatica dei dati registrati", strengths: holdings.length ? ["I movimenti sono organizzati per ETF e permettono di ricostruire le quantità detenute."] : [], attention:deterministic, suggestions:["Aggiungi dati di composizione degli ETF per analizzare sovrapposizioni e concentrazione dei singoli titoli.","Verifica la disponibilità di quotazioni aggiornate per tutte le posizioni prima di interpretare il risultato."], disclaimer:"Analisi informativa basata sui movimenti Supabase. Non è consulenza finanziaria personalizzata." });
    }

    const prompt = [
      "Sei AI Analysis di Il Mio Percorso ETF. Rispondi in italiano, con tono chiaro e prudente.",
      "Analizza esclusivamente i dati JSON forniti. Non inventare prezzi, performance, composizioni, benchmark, overlap o dati macroeconomici.",
      "Se i dati non permettono una conclusione, dichiaralo. Distingui fatti, limiti e ipotesi.",
      "Non dichiarare copertura 100% se anche una sola posizione non ha una quotazione con timestamp. Non chiamare certificato o ufficiale il dato Yahoo Finance. Indica fonte, simbolo e orario quando disponibili; segnala prezzi ritardati o non disponibili.",
      "Non dare ordini di acquisto/vendita né raccomandazioni personalizzate di investimento. Puoi proporre controlli e domande da valutare.",
      "Fornisci: sintesi, punti di forza supportati dai dati, aspetti da monitorare, 3 azioni pratiche di verifica. Massimo 450 parole.",
      "DATI PORTAFOGLIO: " + JSON.stringify(facts),
      "CONTROLLI DETERMINISTICI: " + JSON.stringify(deterministic)
    ].join("\n\n");
    const response = await fetch("https://api.openai.com/v1/responses", {
      method:"POST", headers:{ "Content-Type":"application/json", Authorization:"Bearer " + apiKey },
      body:JSON.stringify({ model:process.env.OPENAI_ANALYSIS_MODEL || "gpt-6-luna", input:prompt, max_output_tokens:700, store:false }),
      signal:AbortSignal.timeout(30000)
    });
    const payload:any = await response.json();
    if (!response.ok) throw new Error(payload?.error?.message || "Servizio AI temporaneamente non disponibile.");
    const text = (payload.output || []).flatMap((item:any)=>item.content || []).filter((part:any)=>part.type==="output_text").map((part:any)=>part.text).join("\n").trim();
    if (!text) throw new Error("L'AI non ha restituito un'analisi leggibile.");
    return NextResponse.json({ mode:"ai", generatedAt:new Date().toISOString(), facts, analysis:text, disclaimer:"Analisi informativa, non consulenza finanziaria. I dati disponibili non includono ancora prezzi live verificati né la composizione interna completa degli ETF." });
  } catch (error) {
    return NextResponse.json({ error:error instanceof Error ? error.message : "Analisi non disponibile." }, { status:503 });
  }
}
