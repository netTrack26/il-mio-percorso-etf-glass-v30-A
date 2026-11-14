import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

async function adminSession() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Configurazione Supabase mancante.");
  const store = await cookies();
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) { try { values.forEach(({ name, value, options }) => store.set(name, value, options)); } catch {} }
    }
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const { data: isAdmin, error: roleError } = await supabase.rpc("is_current_user_admin");
  if (roleError || isAdmin !== true) return null;
  return data.user;
}

function rows(value: any): any[] { return Array.isArray(value) ? value : value && typeof value === "object" ? [value] : []; }
function number(value: any): number | null {
  if (typeof value === "string") value = value.replace("%", "").replace(",", ".");
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function asPercent(value: any): number | null {
  const parsed = number(value);
  if (parsed === null || parsed < 0 || parsed > 100) return null;
  return parsed;
}
async function fmp(path: string, symbol: string, key: string) {
  const url = new URL("https://financialmodelingprep.com/stable/" + path);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("apikey", key);
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20000) });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof payload?.["Error Message"] === "string" ? payload["Error Message"] : "FMP " + path + " HTTP " + response.status);
  if (payload && !Array.isArray(payload) && payload["Error Message"]) throw new Error(String(payload["Error Message"]));
  return rows(payload);
}

export async function POST(request: NextRequest) {
  try {
    const user = await adminSession();
    if (!user) return NextResponse.json({ error: "Operazione riservata all'amministratore." }, { status: 403 });
    const key = process.env.FMP_API_KEY;
    if (!key) return NextResponse.json({
      error: "FMP_API_KEY non configurata. Il collegamento automatico holdings richiede un piano FMP che includa ETF & Fund Holdings; nessun piano a pagamento viene attivato automaticamente."
    }, { status: 503 });

    const body = await request.json().catch(() => ({}));
    const requested = Array.isArray(body?.isins) ? body.isins.map((x: any) => String(x).trim().toUpperCase()).filter((x: string) => /^[A-Z]{2}[A-Z0-9]{10}$/.test(x)).slice(0, 25) : [];
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) throw new Error("Configurazione Supabase server incompleta.");
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    let query = admin.from("etfs").select("isin,ticker,name,issuer,asset_class,domicile,currency,ongoing_charges,replication,distribution_policy,index_name,fund_website");
    if (requested.length) query = query.in("isin", requested);
    const { data: funds, error: fundsError } = await query.limit(25);
    if (fundsError) throw new Error("Lettura catalogo ETF: " + fundsError.message);
    if (!funds?.length) return NextResponse.json({ synced: 0, results: [], message: "Nessun ETF da aggiornare." });

    const results: any[] = [];
    for (const fund of funds) {
      const symbol = String(fund.ticker || "").trim();
      if (!symbol) { results.push({ isin: fund.isin, status: "skipped", reason: "Ticker mancante" }); continue; }
      try {
        const [holdings, infoResult, countriesResult, sectorsResult] = await Promise.allSettled([
          fmp("etf/holdings", symbol, key),
          fmp("etf/info", symbol, key),
          fmp("etf/country-weightings", symbol, key),
          fmp("etf/sector-weightings", symbol, key)
        ]);
        if (holdings.status !== "fulfilled" || !holdings.value.length) {
          const reason = holdings.status === "rejected" ? holdings.reason?.message : "Nessuna holding restituita per il ticker";
          results.push({ isin: fund.isin, symbol, status: "unavailable", reason: String(reason || "Holdings non disponibili") });
          continue;
        }
        const info = infoResult.status === "fulfilled" ? infoResult.value[0] || {} : {};
        const sourceRows = holdings.value;
        const updatedAt = sourceRows.map((x:any)=>x.updatedAt).filter(Boolean).sort().at(-1) || info.updatedAt || null;
        const asOf = updatedAt && /^\\d{4}-\\d{2}-\\d{2}/.test(String(updatedAt)) ? String(updatedAt).slice(0,10) : new Date().toISOString().slice(0,10);
        const snapshot = {
          isin: fund.isin, provider: "financialmodelingprep", provider_symbol: symbol,
          as_of_date: asOf, source_updated_at: updatedAt, source_url: "https://financialmodelingprep.com/developer/docs/stable/holdings",
          license_note: "FMP API: verificare piano e diritti di visualizzazione/redistribuzione prima della pubblicazione commerciale.",
          holdings_count: sourceRows.length,
          holdings_coverage_percent: Math.min(100, sourceRows.reduce((s:number,x:any)=>s+(asPercent(x.weightPercentage)||0),0))
        };
        const { data: savedSnapshot, error: snapshotError } = await admin.from("etf_data_snapshots")
          .upsert(snapshot, { onConflict: "isin,provider,as_of_date" }).select("id").single();
        if (snapshotError || !savedSnapshot) throw new Error("Salvataggio snapshot: " + (snapshotError?.message || "ID non restituito"));
        const snapshotId = savedSnapshot.id;
        const { error: deleteError } = await admin.from("etf_lookthrough_holdings").delete().eq("snapshot_id", snapshotId);
        if (deleteError) throw new Error("Pulizia holdings precedenti: " + deleteError.message);
        const mapped = sourceRows.map((item:any) => {
          const symbolOrIsin = String(item.isin || item.asset || item.symbol || item.name || "").trim();
          const weight = asPercent(item.weightPercentage);
          if (!symbolOrIsin || !String(item.name || item.asset || "").trim() || weight === null) return null;
          const securityIsin = /^[A-Z]{2}[A-Z0-9]{10}$/.test(String(item.isin || "").toUpperCase()) ? String(item.isin).toUpperCase() : null;
          return {
            snapshot_id: snapshotId,
            security_key: securityIsin || String(item.asset || item.symbol || item.name).trim().toUpperCase(),
            security_isin: securityIsin,
            symbol: item.asset || item.symbol || null,
            security_name: String(item.name || item.asset || item.symbol).trim(),
            weight_percent: weight,
            sector: item.sector || item.industry || null,
            country: item.country || null,
            asset_type: item.assetType || item.type || null
          };
        }).filter(Boolean);
        for (let i=0;i<mapped.length;i+=500) {
          const { error } = await admin.from("etf_lookthrough_holdings").insert(mapped.slice(i,i+500));
          if (error) throw new Error("Import holdings: " + error.message);
        }
        const replaceAllocations = async (table: string, items: any[], label: string) => {
          const { error: delError } = await admin.from(table).delete().eq("snapshot_id", snapshotId);
          if (delError) throw new Error("Pulizia " + label + ": " + delError.message);
          const prepared = items.map((item:any) => ({
            snapshot_id: snapshotId,
            [label === "paesi" ? "country" : "sector"]: String(item.country || item.sector || item.industry || "").trim(),
            weight_percent: asPercent(item.weightPercentage ?? item.exposure)
          })).filter((x:any) => x.country || x.sector).filter((x:any)=>x.weight_percent !== null);
          if (prepared.length) {
            const { error } = await admin.from(table).insert(prepared);
            if (error) throw new Error("Import " + label + ": " + error.message);
          }
          return prepared.length;
        };
        const countryCount = countriesResult.status === "fulfilled" ? await replaceAllocations("etf_country_allocations", countriesResult.value, "paesi") : 0;
        const sectorCount = sectorsResult.status === "fulfilled" ? await replaceAllocations("etf_sector_allocations", sectorsResult.value, "settori") : 0;
        const metadata: any = {
          metadata_source: "financialmodelingprep",
          metadata_as_of: updatedAt,
          metadata_verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        if (info.etfCompany || info.issuer) metadata.issuer = info.etfCompany || info.issuer;
        if (info.domicile) metadata.domicile = info.domicile;
        if (info.navCurrency || info.currency) metadata.currency = info.navCurrency || info.currency;
        if (number(info.expenseRatio) !== null) metadata.ongoing_charges = number(info.expenseRatio);
        if (info.assetClass) metadata.asset_class = info.assetClass;
        if (info.indexName || info.index) metadata.index_name = info.indexName || info.index;
        if (info.website) metadata.fund_website = info.website;
        const { error: metadataError } = await admin.from("etfs").update(metadata).eq("isin", fund.isin);
        if (metadataError) throw new Error("Aggiornamento metadati: " + metadataError.message);
        results.push({ isin: fund.isin, symbol, status: "synced", asOf, holdings: mapped.length, countries: countryCount, sectors: sectorCount, infoAvailable: infoResult.status === "fulfilled" });
      } catch (error) {
        results.push({ isin: fund.isin, symbol, status: "error", reason: error instanceof Error ? error.message : "Errore provider" });
      }
    }
    const synced = results.filter(x=>x.status==="synced").length;
    return NextResponse.json({ provider: "Financial Modeling Prep", synced, attempted: results.length, results, note: "I dati sono snapshot del provider: verificare copertura, timestamp e licenza di redistribuzione." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Sincronizzazione ETF non riuscita." }, { status: 503 });
  }
}
