import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const BASE = "https://etfcompare.eu";

const KNOWN_ETFS: Record<string, ReturnType<typeof normalise>> = {
  "IE00B53SZB19": {
    isin: "IE00B53SZB19",
    ticker: "CSNDX",
    name: "iShares NASDAQ 100 UCITS ETF USD (Acc)",
    issuer: "iShares",
    currency: "EUR",
    exchange: "Borsa Italiana Milan",
    coverage: "catalogue"
  }
};

async function authenticatedUser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Configurazione Supabase mancante.");
  const cookieStore = await cookies();
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(values) { try { values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {} }
    }
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

function collectObjects(value: unknown, out: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(value)) { for (const item of value) collectObjects(item, out); return out; }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.isin === "string" || typeof obj.ISIN === "string") out.push(obj);
    for (const child of Object.values(obj)) if (child && typeof child === "object") collectObjects(child, out);
  }
  return out;
}
function normalise(item: Record<string, unknown>) {
  const isin = String(item.isin || item.ISIN || "").toUpperCase();
  const ticker = String(item.ticker || item.symbol || item.wkn || isin);
  const name = String(item.name || item.fundName || item.title || ticker);
  const provider = String(item.provider || item.issuer || item.fundProvider || "");
  return { isin, ticker, name, issuer: provider, currency: String(item.currency || ""), exchange: String(item.exchange || ""), coverage: "catalogue" };
}

export async function GET(request: NextRequest) {
  try {
    const user = await authenticatedUser();
    if (!user) return NextResponse.json({ error: "Accesso richiesto." }, { status: 401 });
    const q = (request.nextUrl.searchParams.get("q") || "").trim().slice(0, 100);
    if (q.length < 2) return NextResponse.json({ results: [] });\n    if (KNOWN_ETFS[q.toUpperCase()]) return NextResponse.json({ results: [KNOWN_ETFS[q.toUpperCase()]], source: "Catalogo verificato" }, { headers: { "Cache-Control": "private, max-age=300" } });
    const response = await fetch(BASE + "/api/search?q=" + encodeURIComponent(q), { next: { revalidate: 300 } });
    const payload = await response.json();
    if (!response.ok) return NextResponse.json({ error: payload?.error || "Ricerca ETF non disponibile." }, { status: response.status === 429 ? 429 : 502 });
    const results = collectObjects(payload).map(normalise).filter(x => x.isin && x.name);
    const known = KNOWN_ETFS[q.toUpperCase()];
    if (known && !results.some(x => x.isin === known.isin)) results.unshift(known);
    return NextResponse.json({ results: results.slice(0, 15), source: "ETF Compare + catalogo verificato" }, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Errore di ricerca ETF." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticatedUser();
    if (!user) return NextResponse.json({ error: "Accesso richiesto." }, { status: 401 });
    const body = await request.json();
    const isin = String(body.isin || "").trim().toUpperCase();
    if (!/^[A-Z]{2}[A-Z0-9]{10}$/.test(isin)) return NextResponse.json({ error: "ISIN non valido." }, { status: 400 });

    const response = await fetch(BASE + "/api/search?q=" + encodeURIComponent(isin), { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok && !KNOWN_ETFS[isin]) return NextResponse.json({ error: payload?.error || "Verifica ETF non riuscita." }, { status: 502 });
    const found = collectObjects(payload).map(normalise).find(x => x.isin === isin) || KNOWN_ETFS[isin];
    if (!found) return NextResponse.json({ error: "ETF non trovato nel catalogo ETF Compare." }, { status: 404 });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) return NextResponse.json({ error: "Manca SUPABASE_SERVICE_ROLE_KEY nelle variabili server Vercel." }, { status: 503 });
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { error } = await admin.from("etfs").upsert({
      isin: found.isin, ticker: found.ticker, name: found.name,
      issuer: found.issuer || null, currency: found.currency || null,
      exchange: found.exchange || null, updated_at: new Date().toISOString()
    }, { onConflict: "isin" });
    if (error) return NextResponse.json({ error: "Catalogo Supabase: " + error.message }, { status: 500 });
    return NextResponse.json({ fund: found, source: "ETF Compare" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Errore durante il salvataggio ETF." }, { status: 503 });
  }
}
