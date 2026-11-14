import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { fetchYahooChart } from "@/lib/yahoo-finance";

export const runtime = "nodejs";
async function getSessionClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Configurazione Supabase mancante.");
  const store = await cookies();
  const supabase = createServerClient(url, anon, { cookies: { getAll: () => store.getAll(), setAll(values) { try { values.forEach(({ name, value, options }) => store.set(name, value, options)); } catch {} } } });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return supabase;
}
type Position = { isin: string; quantity: number };
export async function POST(request: NextRequest) {
  try {
    const supabase = await getSessionClient();
    if (!supabase) return NextResponse.json({ error: "Accesso richiesto." }, { status: 401 });
    const body = await request.json();
    const startDate = typeof body.startDate === "string" && /^\\d{4}-\\d{2}-\\d{2}$/.test(body.startDate) ? body.startDate : null;
    const positions: Position[] = Array.isArray(body.positions) ? body.positions.slice(0, 30).map((p: any) => ({ isin: String(p.isin || "").toUpperCase(), quantity: Number(p.quantity) })) : [];
    if (!positions.length || positions.some(p => !/^[A-Z]{2}[A-Z0-9]{10}$/.test(p.isin) || !Number.isFinite(p.quantity) || p.quantity <= 0)) return NextResponse.json({ error: "Le posizioni inviate non sono valide." }, { status: 400 });
    const isins = [...new Set(positions.map(p => p.isin))];
    const { data: instruments, error } = await supabase.from("etfs").select("isin,ticker,exchange,currency").in("isin", isins);
    if (error) throw new Error("Lettura catalogo ETF non riuscita: " + error.message);
    const byIsin = new Map<string, any>((instruments || []).map((x: any) => [String(x.isin), x] as [string, any]));
    const histories = await Promise.all(positions.map(async p => {
      const instrument = byIsin.get(p.isin);
      if (!instrument) throw new Error("ETF non presente nel catalogo: " + p.isin);
      const chart = await fetchYahooChart(instrument, "max", "1d");
      const points = chart.points.filter(point => !startDate || point.date >= startDate);
      if (points.length < 2) throw new Error("Storico Yahoo insufficiente per " + p.isin + ".");
      return { ...p, currency: chart.currency, points };
    }));
    const dates = [...new Set(histories.flatMap(h => h.points.map(p => p.date)))].sort();
    const currencies = [...new Set(histories.map(h => h.currency).filter(c => c !== "EUR"))];
    const fxByCurrency = new Map<string, Map<string, number>>();
    for (const currency of currencies) {
      const fxResponse = await fetch("https://api.frankfurter.dev/v1/" + dates[0] + ".." + dates[dates.length - 1] + "?from=" + encodeURIComponent(currency) + "&to=EUR", { cache: "no-store" });
      if (!fxResponse.ok) throw new Error("Cambio storico " + currency + "/EUR temporaneamente non disponibile.");
      const payload: any = await fxResponse.json();
      const rates = new Map<string, number>();
      Object.entries(payload?.rates || {}).forEach(([date, values]: [string, any]) => { const rate = Number(values?.EUR); if (Number.isFinite(rate) && rate > 0) rates.set(date, rate); });
      if (!rates.size) throw new Error("Cambio storico " + currency + "/EUR non disponibile.");
      fxByCurrency.set(currency, rates);
    }
    const latest = new Array(histories.length).fill(null) as (number | null)[];
    const cursors = new Array(histories.length).fill(0);
    const lastFx = new Map<string, number>();
    const output: { date: string; value: number }[] = [];
    for (const date of dates) {
      histories.forEach((h, i) => { while (cursors[i] < h.points.length && h.points[cursors[i]].date <= date) latest[i] = h.points[cursors[i]++].price; });
      if (latest.every((v): v is number => v !== null)) {
        let value = 0;
        histories.forEach((h, i) => {
          let price = latest[i]!;
          if (h.currency !== "EUR") {
            const rates = fxByCurrency.get(h.currency)!;
            const applicable = [...rates.entries()].filter(([d]) => d <= date).sort((a,b) => b[0].localeCompare(a[0]))[0];
            if (applicable) lastFx.set(h.currency, applicable[1]);
            const fx = lastFx.get(h.currency);
            if (!fx) throw new Error("Cambio " + h.currency + "/EUR non disponibile alla data " + date + ".");
            price *= fx;
          }
          value += h.quantity * price;
        });
        output.push({ date, value: Number(value.toFixed(2)) });
      }
    }
    if (output.length < 2) return NextResponse.json({ error: "Lo storico comune degli ETF non contiene abbastanza rilevazioni." }, { status: 422 });
    return NextResponse.json({ points: output, source: "Yahoo Finance + tassi BCE (Frankfurter)", currency: "EUR", asOf: output.at(-1)?.date, fxConverted: currencies.length > 0 }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Storico di mercato temporaneamente non disponibile." }, { status: 503 });
  }
}
