import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { fetchYahooChart, convertQuoteToEur } from "../../../lib/yahoo-finance";

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

type QuoteAudit = {
  source: string;
  symbol: string;
  time: string | null;
  marketState: string;
  freshness: "fresh" | "delayed" | "unavailable";
  currency: string;
  originalCurrency: string;
  fxRate: number | null;
};
type Holding = {
  isin: string;
  ticker: string;
  name: string;
  issuer: string | null;
  quantity: number;
  invested: number;
  currentValue: number;
  weight: number;
  pnl: number;
  assetClass: string | null;
  domicile: string | null;
  fundCurrency: string | null;
  exchange: string | null;
  exchangeMic: string | null;
  ter: number | null;
  replication: string | null;
  distributionPolicy: string | null;
  quote: QuoteAudit | null;
};
type StructuredReport = {
  executiveSummary: string;
  portfolioComposition: string;
  performance: string;
  diversification: string;
  overlap: string;
  geographicExposure: string;
  sectorExposure: string;
  costsAndFees: string;
  pacAnalysis: string;
  quoteQuality: string;
  riskAssessment: string;
  strengths: string[];
  monitoringItems: string[];
  verificationActions: string[];
  methodology: string;
  limitations: string;
};

function localInsights(holdings: Holding[], total: number, invested: number, pacMonthly: number) {
  const top = [...holdings].sort((a,b)=>b.weight-a.weight)[0];
  const pnl = total - invested;
  const notes: string[] = [];
  if (holdings.length === 1) notes.push("Il portafoglio contiene un solo ETF: la diversificazione tra strumenti è limitata. La diversificazione interna non è misurabile senza le partecipazioni sottostanti.");
  else if (holdings.length > 1) notes.push("Il portafoglio contiene " + holdings.length + " ETF. Il numero di strumenti non dimostra da solo una diversificazione effettiva: occorre confrontare le partecipazioni sottostanti.");
  if (top) notes.push(top.ticker + " pesa circa il " + top.weight.toFixed(1) + "% del controvalore.");
  if (invested > 0) notes.push("Il risultato non realizzato rispetto al costo ricostruito è " + (pnl >= 0 ? "positivo di " : "negativo di ") + Math.abs(pnl).toFixed(2) + " EUR (" + ((pnl/invested)*100).toFixed(2) + "%). Non è un rendimento storico certificato.");
  if (pacMonthly > 0) notes.push("I piani PAC attivi equivalgono a " + pacMonthly.toFixed(2) + " EUR al mese. Non sono disponibili dati su reddito, liquidità o altre spese per valutarne la sostenibilità.");
  if (!holdings.length) notes.push("Non risultano posizioni attive ricostruibili dai movimenti.");
  return notes;
}

function outputText(payload: any): string {
  return (payload?.output || []).flatMap((item: any) => item.content || [])
    .filter((part: any) => part.type === "output_text" && typeof part.text === "string")
    .map((part: any) => part.text).join("\n").trim();
}

function validateReport(value: any): value is StructuredReport {
  const requiredText: Array<keyof StructuredReport> = [
    "executiveSummary","portfolioComposition","performance","diversification","overlap",
    "geographicExposure","sectorExposure","costsAndFees","pacAnalysis","quoteQuality",
    "riskAssessment","methodology","limitations"
  ];
  if (!value || typeof value !== "object") return false;
  if (requiredText.some(key => typeof value[key] !== "string" || !value[key].trim())) return false;
  if (!Array.isArray(value.strengths) || value.strengths.length < 2 || value.strengths.some((x: unknown) => typeof x !== "string" || !x.trim())) return false;
  if (!Array.isArray(value.monitoringItems) || value.monitoringItems.length < 3 || value.monitoringItems.some((x: unknown) => typeof x !== "string" || !x.trim())) return false;
  if (!Array.isArray(value.verificationActions) || value.verificationActions.length !== 3 || value.verificationActions.some((x: unknown) => typeof x !== "string" || !x.trim())) return false;
  return true;
}

function reportToMarkdown(report: StructuredReport): string {
  const sections: Array<[string,string]> = [
    ["SINTESI ESECUTIVA", report.executiveSummary],
    ["COMPOSIZIONE DEL PORTAFOGLIO", report.portfolioComposition],
    ["RISULTATO E PERFORMANCE", report.performance],
    ["DIVERSIFICAZIONE", report.diversification],
    ["SOVRAPPOSIZIONI TRA ETF", report.overlap],
    ["ESPOSIZIONE GEOGRAFICA", report.geographicExposure],
    ["ESPOSIZIONE SETTORIALE", report.sectorExposure],
    ["COSTI E COMMISSIONI", report.costsAndFees],
    ["ANALISI DEI PIANI PAC", report.pacAnalysis],
    ["QUALITÀ E FRESCHEZZA DEI PREZZI", report.quoteQuality],
    ["RISCHI E PUNTI DI ATTENZIONE", report.riskAssessment],
    ["PUNTI DI FORZA", report.strengths.map(x => "- " + x).join("\n")],
    ["ELEMENTI DA MONITORARE", report.monitoringItems.map(x => "- " + x).join("\n")],
    ["TRE VERIFICHE PRATICHE", report.verificationActions.map((x,i) => (i+1) + ". " + x).join("\n")],
    ["METODOLOGIA", report.methodology],
    ["LIMITI DELL'ANALISI", report.limitations]
  ];
  return sections.map(([title,body]) => "### " + title + "\n" + body).join("\n\n");
}

const reportSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    executiveSummary: { type: "string" },
    portfolioComposition: { type: "string" },
    performance: { type: "string" },
    diversification: { type: "string" },
    overlap: { type: "string" },
    geographicExposure: { type: "string" },
    sectorExposure: { type: "string" },
    costsAndFees: { type: "string" },
    pacAnalysis: { type: "string" },
    quoteQuality: { type: "string" },
    riskAssessment: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    monitoringItems: { type: "array", items: { type: "string" } },
    verificationActions: { type: "array", items: { type: "string" } },
    methodology: { type: "string" },
    limitations: { type: "string" }
  },
  required: [
    "executiveSummary","portfolioComposition","performance","diversification","overlap",
    "geographicExposure","sectorExposure","costsAndFees","pacAnalysis","quoteQuality",
    "riskAssessment","strengths","monitoringItems","verificationActions","methodology","limitations"
  ]
};

async function requestCompleteReport(apiKey: string, model: string, facts: any, deterministic: string[], maxOutputTokens: number) {
  const prompt = [
    "Sei l'analista di portafoglio di Il Mio Percorso ETF. Scrivi in italiano, in modo professionale, concreto e prudente.",
    "Devi compilare TUTTI i campi dello schema. Ogni campo testuale deve essere completo e autonomo, con frasi finite. Non interrompere mai un elenco a metà.",
    "Usa esclusivamente i dati JSON forniti. Non inventare performance storiche, benchmark, holdings, pesi geografici, settori, sovrapposizioni, TER o dati fiscali.",
    "IMPORTANTE: non sono stati forniti i dati dei titoli sottostanti (look-through holdings). Perciò dichiara esplicitamente che overlap, settore e geografia a livello aggregato non sono calcolabili in modo affidabile; puoi descrivere solo l'esposizione dichiarata nel nome/indice dei fondi come indicazione qualitativa, non come misura.",
    "Distingui capitale investito, valore stimato, risultato non realizzato e rendimento storico. Non chiamare Yahoo Finance fonte ufficiale o prezzo certificato.",
    "Una quotazione è recente solo se ha timestamp e freshness=fresh. Non dichiarare copertura completa se non tutti i prezzi sono recenti e disponibili.",
    "I prezzi e i controvalori sono in EUR. Le valute del fondo e delle quotazioni originali restano metadati e non indicano necessariamente il rischio valutario effettivo.",
    "Non dare ordini di acquisto o vendita, né consulenza finanziaria personalizzata. Le verifiche pratiche sono controlli neutrali e non ordini.",
    "Produci 2-4 punti di forza, almeno 3 elementi da monitorare ed ESATTAMENTE 3 verifiche pratiche numerate. Ogni elemento deve essere una frase completa.",
    "Ogni sezione testuale deve contenere indicativamente 2-5 frasi; non comprimere le verifiche pratiche. Il report deve essere leggibile anche nel PDF.",
    "DATI STRUTTURATI DEL PORTAFOGLIO: " + JSON.stringify(facts),
    "CONTROLLI QUANTITATIVI DETERMINISTICI: " + JSON.stringify(deterministic)
  ].join("\n\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
    body: JSON.stringify({
      model,
      input: prompt,
      text: { format: { type: "json_schema", name: "portfolio_analysis_report", strict: true, schema: reportSchema } },
      max_output_tokens: maxOutputTokens,
      store: false
    }),
    signal: AbortSignal.timeout(45000)
  });
  const payload: any = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || "Servizio AI temporaneamente non disponibile.");
  if (payload.status === "incomplete" || payload.incomplete_details) {
    return { incomplete: true, reason: payload.incomplete_details?.reason || "unknown", payload };
  }
  const refusal = (payload.output || []).flatMap((item: any) => item.content || []).find((part: any) => part.refusal);
  if (refusal) throw new Error("L'AI non ha generato il report: " + String(refusal.refusal).slice(0, 300));
  const text = outputText(payload);
  if (!text) throw new Error("L'AI non ha restituito un report leggibile.");
  let parsed: any;
  try { parsed = JSON.parse(text); } catch { throw new Error("Il report AI non è arrivato in formato completo. Riprova l'analisi."); }
  if (!validateReport(parsed)) throw new Error("Il report AI è incompleto: alcune sezioni o verifiche pratiche mancano. Riprova l'analisi.");
  return { incomplete: false, report: parsed as StructuredReport };
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionClient();
    if (!session) return NextResponse.json({ error: "Accedi per utilizzare AI Analysis." }, { status: 401 });
    const { supabase, user } = session;
    const [{ data: rows, error: txError }, { data: pacRows, error: pacError }] = await Promise.all([
      supabase.from("portfolio_transactions").select("isin,transaction_type,quantity,unit_price,fees,executed_at,etfs(ticker,name)").eq("user_id", user.id).order("executed_at", { ascending: true }),
      supabase.from("pac_plans").select("amount,frequency,active").eq("user_id", user.id)
    ]);
    if (txError) throw new Error("Lettura movimenti non riuscita: " + txError.message);
    if (pacError) throw new Error("Lettura piani PAC non riuscita: " + pacError.message);

    const map = new Map<string, { ticker:string; name:string; quantity:number; cost:number }>();
    for (const row of rows || []) {
      const relation = Array.isArray(row.etfs) ? row.etfs[0] : row.etfs;
      const isin = String(row.isin || "").toUpperCase();
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
      isin, ticker:v.ticker, name:v.name, issuer:null, quantity:Number(v.quantity.toFixed(6)), invested:Number(v.cost.toFixed(2)),
      currentValue:Number(v.cost.toFixed(2)), weight:0, pnl:0, assetClass:null, domicile:null, fundCurrency:null,
      exchange:null, exchangeMic:null, ter:null, replication:null, distributionPolicy:null, quote:null
    }));
    const isins = holdings.map(h=>h.isin);
    if (isins.length) {
      const { data: instruments, error: catalogError } = await supabase.from("etfs")
        .select("isin,ticker,name,issuer,asset_class,domicile,currency,exchange,exchange_mic,ongoing_charges,replication,distribution_policy")
        .in("isin", isins);
      if (catalogError) throw new Error("Lettura metadati ETF non riuscita: " + catalogError.message);
      const byIsin = new Map<string, any>((instruments || []).map((item:any)=>[String(item.isin).toUpperCase(), item]));
      await Promise.all(holdings.map(async holding => {
        const instrument = byIsin.get(holding.isin);
        if (!instrument) return;
        holding.ticker = String(instrument.ticker || holding.ticker);
        holding.name = String(instrument.name || holding.name);
        holding.issuer = instrument.issuer || null;
        holding.assetClass = instrument.asset_class || null;
        holding.domicile = instrument.domicile || null;
        holding.fundCurrency = instrument.currency || null;
        holding.exchange = instrument.exchange || null;
        holding.exchangeMic = instrument.exchange_mic || null;
        holding.ter = instrument.ongoing_charges === null ? null : Number(instrument.ongoing_charges);
        holding.replication = instrument.replication || null;
        holding.distributionPolicy = instrument.distribution_policy || null;
        try {
          const quote = await fetchYahooChart(instrument, "5d", "1d");
          const converted = await convertQuoteToEur(quote.price, quote.currency);
          const quoteMillis = quote.quoteTime ? new Date(quote.quoteTime).getTime() : 0;
          const ageHours = quoteMillis > 0 ? (Date.now() - quoteMillis) / 3600000 : Infinity;
          const freshness = ageHours <= 36 ? "fresh" : "delayed";
          holding.currentValue = Number((holding.quantity * converted.priceEur).toFixed(2));
          holding.quote = { source:"Yahoo Finance", symbol:quote.symbol, time:quote.quoteTime, marketState:quote.marketState, freshness, currency:"EUR", originalCurrency:converted.originalCurrency, fxRate:converted.fxRate };
        } catch {
          holding.quote = { source:"Yahoo Finance", symbol:String(instrument.ticker || holding.ticker), time:null, marketState:"UNAVAILABLE", freshness:"unavailable", currency:"EUR", originalCurrency:String(instrument.currency || "EUR"), fxRate:null };
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
    const totalWeight = holdings.reduce((sum,h)=>sum+h.weight,0);
    const topHolding = [...holdings].sort((a,b)=>b.weight-a.weight)[0] || null;
    const knownTer = holdings.filter(h=>h.ter!==null && Number.isFinite(h.ter));
    const terCoverageWeight = knownTer.reduce((sum,h)=>sum+h.weight,0);
    const weightedTer = totalWeight>0 && terCoverageWeight>0
      ? knownTer.reduce((sum,h)=>sum+(h.ter||0)*(h.weight/totalWeight),0)/ (terCoverageWeight/totalWeight)
      : null;
    const hhi = holdings.reduce((sum,h)=>sum+Math.pow(h.weight/100,2),0);
    const facts = {
      generatedAt: new Date().toISOString(),
      currency: "EUR",
      holdings,
      invested: Number(invested.toFixed(2)),
      currentValue: Number(total.toFixed(2)),
      unrealizedResult: Number((total-invested).toFixed(2)),
      unrealizedResultPercent: invested>0 ? Number(((total-invested)/invested*100).toFixed(2)) : null,
      holdingCount: holdings.length,
      topHolding: topHolding ? {ticker:topHolding.ticker,weight:Number(topHolding.weight.toFixed(2))} : null,
      concentrationHhi: Number(hhi.toFixed(4)),
      liveQuoteCount,
      delayedQuoteCount,
      unavailableQuoteCount,
      quoteCoveragePercent: holdings.length ? Number((liveQuoteCount/holdings.length*100).toFixed(1)) : 0,
      activePacMonthlyEquivalent: Number(pacMonthly.toFixed(2)),
      weightedTerPercent: weightedTer===null ? null : Number(weightedTer.toFixed(4)),
      terCoverageWeightPercent: Number(terCoverageWeight.toFixed(2)),
      lookThroughHoldingsAvailable: false,
      lookThroughDataNote: "Non è collegato un archivio aggiornato delle partecipazioni sottostanti per tutti gli ETF. Non calcolare overlap, pesi geografici o settoriali aggregati senza tali file.",
      dataLimitations: "Le quotazioni sono richieste direttamente a Yahoo Finance durante questa analisi. Fresca significa timestamp entro 36 ore e non certificazione o licenza del dato. Se la richiesta fallisce, il valore rimane al costo ricostruito e la posizione è marcata non disponibile. I campi di catalogo possono essere incompleti."
    };
    const deterministic = localInsights(holdings, total, invested, pacMonthly);
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ mode:"rules", reportComplete:false, generatedAt:facts.generatedAt, facts, summary:"Analisi automatica dei dati registrati", strengths: deterministic.slice(0,2), attention:deterministic, suggestions:["Collega un archivio aggiornato delle partecipazioni sottostanti per calcolare overlap, settori e geografia.","Verifica le quotazioni e completa i metadati mancanti del catalogo ETF."], disclaimer:"Analisi informativa basata sui movimenti Supabase. Non è consulenza finanziaria personalizzata." });
    }

    const model = process.env.OPENAI_ANALYSIS_MODEL || "gpt-6-luna";
    let result = await requestCompleteReport(apiKey, model, facts, deterministic, 4500);
    if (result.incomplete && result.reason === "max_output_tokens") {
      result = await requestCompleteReport(apiKey, model, facts, deterministic, 6500);
    }
    if (result.incomplete) throw new Error("Il report AI non è stato completato dal modello. Nessun testo parziale è stato mostrato: riprova tra poco.");
    const report = result.report as StructuredReport;
    return NextResponse.json({
      mode:"ai",
      reportComplete:true,
      generatedAt:facts.generatedAt,
      facts,
      report,
      analysis:reportToMarkdown(report),
      disclaimer:"Analisi informativa, non consulenza finanziaria personalizzata. I dati sottostanti degli ETF non sono ancora disponibili per un look-through completo."
    });
  } catch (error) {
    return NextResponse.json({ error:error instanceof Error ? error.message : "Analisi non disponibile." }, { status:503 });
  }
}
