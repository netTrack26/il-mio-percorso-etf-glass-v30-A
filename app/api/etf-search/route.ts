import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type ProviderFund = {
  isin: string;
  name: string;
  issuer?: string | null;
  currency?: string | null;
  assetClass?: string | null;
  listing?: { ticker?: string | null; mic?: string | null; exchange?: string | null; currency?: string | null } | null;
  coverage?: string;
};

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error("Configurazione server mancante: " + name);
  return value;
}

async function authenticatedUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(values) { try { values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {} }
    }
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

export async function GET(request: NextRequest) {
  try {
    const user = await authenticatedUser();
    if (!user) return NextResponse.json({ error: "Accesso richiesto." }, { status: 401 });
    const q = (request.nextUrl.searchParams.get("q") || "").trim().slice(0, 100);
    if (q.length < 2) return NextResponse.json({ results: [] });
    const response = await fetch("https://fundfactsapi.com/api/v1/search?q=" + encodeURIComponent(q) + "&limit=10", {
      headers: { Authorization: "Bearer " + env("FUNDFACTS_API_KEY") },
      next: { revalidate: 60 }
    });
    const payload = await response.json();
    if (!response.ok) return NextResponse.json({ error: payload?.error?.message || "Ricerca provider non disponibile." }, { status: response.status === 429 ? 429 : 502 });
    const results = (payload.results || []).filter((x: ProviderFund) => x.isin && x.name).map((x: ProviderFund) => ({
      isin: x.isin,
      name: x.name,
      issuer: x.issuer || "",
      ticker: x.listing?.ticker || "",
      currency: x.listing?.currency || x.currency || "",
      exchange: x.listing?.exchange || "",
      mic: x.listing?.mic || "",
      assetClass: x.assetClass || "",
      coverage: x.coverage || "unknown"
    }));
    return NextResponse.json({ results, source: "FundFacts API" }, { headers: { "Cache-Control": "private, max-age=30" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Errore di ricerca." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticatedUser();
    if (!user) return NextResponse.json({ error: "Accesso richiesto." }, { status: 401 });
    const body = await request.json();
    const isin = String(body.isin || "").trim().toUpperCase();
    if (!/^[A-Z]{2}[A-Z0-9]{10}$/.test(isin)) return NextResponse.json({ error: "ISIN non valido." }, { status: 400 });

    const lookup = await fetch("https://fundfactsapi.com/api/v1/search?q=" + encodeURIComponent(isin) + "&limit=10", {
      headers: { Authorization: "Bearer " + env("FUNDFACTS_API_KEY") },
      cache: "no-store"
    });
    const payload = await lookup.json();
    if (!lookup.ok) return NextResponse.json({ error: payload?.error?.message || "Verifica ETF non riuscita." }, { status: 502 });
    const fund = (payload.results || []).find((x: ProviderFund) => x.isin === isin);
    if (!fund) return NextResponse.json({ error: "ETF non trovato dal provider." }, { status: 404 });

    const admin = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const row = {
      isin,
      ticker: fund.listing?.ticker || isin,
      name: fund.name,
      issuer: fund.issuer || null,
      asset_class: fund.assetClass || null,
      currency: fund.listing?.currency || fund.currency || null,
      exchange: fund.listing?.exchange || null,
      exchange_mic: fund.listing?.mic || null,
      updated_at: new Date().toISOString()
    };
    const { error } = await admin.from("etfs").upsert(row, { onConflict: "isin" });
    if (error) return NextResponse.json({ error: "Catalogo Supabase: " + error.message }, { status: 500 });
    return NextResponse.json({ fund: { isin, ticker: row.ticker, name: row.name, issuer: row.issuer } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Errore durante il salvataggio ETF." }, { status: 503 });
  }
}
