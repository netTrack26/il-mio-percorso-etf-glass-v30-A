export type YahooInstrument = { isin: string; ticker: string; exchange?: string | null; currency?: string | null };
export type YahooPoint = { date: string; price: number };
export type YahooChart = { symbol: string; currency: string; price: number; quoteTime: string | null; marketState: string; points: YahooPoint[] };

export function yahooSymbols(instrument: YahooInstrument): string[] {
  const raw = String(instrument.ticker || "").trim().toUpperCase();
  if (!raw) return [];
  if (raw.includes(".")) return [raw];
  const exchange = String(instrument.exchange || "").toUpperCase();
  const suffixes: Array<[RegExp, string]> = [
    [/XETRA|XETR|FRANKFURT|DEUTSCHE B.RSE/, ".DE"], [/LSE|LONDON/, ".L"], [/AMS|AMSTERDAM/, ".AS"],
    [/MIL|XMIL|BORSA ITALIANA|MILAN|BIT/, ".MI"], [/PARIS|EURONEXT PARIS|EPA/, ".PA"], [/SWISS|SIX|ZURICH/, ".SW"],
    [/MADRID|BME|SPAIN/, ".MC"], [/BRUSSELS/, ".BR"], [/OSLO/, ".OL"], [/STOCKHOLM/, ".ST"], [/COPENHAGEN/, ".CO"],
    [/HELSINKI/, ".HE"], [/TORONTO|TSX/, ".TO"], [/AUSTRALIA|ASX|SYDNEY/, ".AX"], [/HONG KONG|HKEX/, ".HK"],
    [/TOKYO|JAPAN/, ".T"], [/NASDAQ|NYSE|NEW YORK|OTC/, ""]
  ];
  for (const [pattern, suffix] of suffixes) if (pattern.test(exchange)) return [raw + suffix];
  // Fallback for older catalog rows that have no exchange metadata.
  return [raw + ".MI", raw + ".DE", raw + ".L", raw];
}

export async function fetchYahooChart(instrument: YahooInstrument, range = "5d", interval = "1d"): Promise<YahooChart> {
  const symbols = yahooSymbols(instrument);
  if (!symbols.length) throw new Error("Ticker non disponibile nel catalogo ETF.");
  let result: any = null, symbol = symbols[0], lastError = "";
  for (const candidate of symbols) {
    try {
      const url = new URL("https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(candidate));
      url.searchParams.set("range", range); url.searchParams.set("interval", interval); url.searchParams.set("events", "div,splits");
      const response = await fetch(url, { cache: "no-store", headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; IlMioPercorsoETF/1.0)" }, signal: AbortSignal.timeout(12000) });
      if (!response.ok) { lastError = "Yahoo Finance HTTP " + response.status; continue; }
      const payload: any = await response.json();
      const found = payload?.chart?.result?.[0];
      if (found) {
        const ts: number[] = Array.isArray(found.timestamp) ? found.timestamp : [];
        const adj: Array<number | null> = found.indicators?.adjclose?.[0]?.adjclose || [];
        const close: Array<number | null> = found.indicators?.quote?.[0]?.close || [];
        const usable = ts.filter((_, i) => Number(adj[i] ?? close[i]) > 0 && Number.isFinite(Number(adj[i] ?? close[i]))).length;
        if (range === "max" && usable < 2) { lastError = "Storico insufficiente per " + candidate; continue; }
        result = found; symbol = candidate; break;
      }
      lastError = String(payload?.chart?.error?.description || "Nessun dato per " + candidate);
    } catch (error) { lastError = error instanceof Error ? error.message : "Errore Yahoo Finance"; }
  }
  if (!result) throw new Error(lastError || "Nessun dato Yahoo Finance per " + instrument.ticker + ".");
  const meta = result.meta || {};
  const timestamps: number[] = Array.isArray(result.timestamp) ? result.timestamp : [];
  const adjusted: Array<number | null> = result.indicators?.adjclose?.[0]?.adjclose || [];
  const regular: Array<number | null> = result.indicators?.quote?.[0]?.close || [];
  const points = timestamps.map((time, i) => {
    const raw = adjusted[i] ?? regular[i];
    return { date: new Date(time * 1000).toISOString().slice(0, 10), price: raw === null || raw === undefined ? NaN : Number(raw) };
  }).filter(p => Number.isFinite(p.price) && p.price > 0);
  const price = Number(meta.regularMarketPrice ?? points.at(-1)?.price);
  if (!Number.isFinite(price) || price <= 0) throw new Error("Prezzo corrente non disponibile per " + symbol + ".");
  const quoteTimeSeconds = Number(meta.regularMarketTime || timestamps.at(-1) || 0);
  return { symbol, currency: String(meta.currency || instrument.currency || "EUR").toUpperCase(), price, quoteTime: quoteTimeSeconds ? new Date(quoteTimeSeconds * 1000).toISOString() : null, marketState: String(meta.marketState || "UNKNOWN").toUpperCase(), points };
}
