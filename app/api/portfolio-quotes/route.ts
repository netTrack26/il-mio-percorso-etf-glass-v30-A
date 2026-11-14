import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { fetchYahooChart } from "../../../lib/yahoo-finance";
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
export async function POST(request: NextRequest) {
  try {
    const supabase = await getSessionClient();
    if (!supabase) return NextResponse.json({ error: "Accesso richiesto." }, { status: 401 });
    const body = await request.json();
    const isins = [...new Set((Array.isArray(body.isins) ? body.isins : []).map((x: unknown) => String(x).toUpperCase()).filter((x: string) => /^[A-Z]{2}[A-Z0-9]{10}$/.test(x)))].slice(0, 30);
    if (!isins.length) return NextResponse.json({ quotes: [], errors: [] });
    const { data: instruments, error } = await supabase.from("etfs").select("isin,ticker,exchange,currency").in("isin", isins);
    if (error) throw new Error("Lettura catalogo ETF non riuscita: " + error.message);
    const results = await Promise.all((instruments || []).map(async (instrument: any) => {
      try {
        const quote = await fetchYahooChart(instrument, "5d", "1d");
        const previousClose = quote.points.length > 1 ? quote.points[quote.points.length - 2].price : quote.price;
        const change = previousClose > 0 ? ((quote.price - previousClose) / previousClose) * 100 : 0;
        return { isin: instrument.isin, ...quote, previousClose, change, error: null };
      } catch (e) { return { isin: instrument.isin, error: e instanceof Error ? e.message : "Quotazione non disponibile." }; }
    }));
    return NextResponse.json({ quotes: results.filter(x => !x.error), errors: results.filter(x => x.error), source: "Yahoo Finance", fetchedAt: new Date().toISOString() }, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Quotazioni non disponibili." }, { status: 503 });
  }
}
