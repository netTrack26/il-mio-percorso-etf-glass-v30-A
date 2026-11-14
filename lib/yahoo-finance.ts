export type YahooInstrument = { isin: string; ticker: string; exchange?: string | null; currency?: string | null };
export type YahooPoint = { date: string; price: number };
export type YahooChart = { symbol: string; currency: string; price: number; quoteTime: string | null; marketState: string; points: YahooPoint[] };

export function yahooSymbols(instrument: YahooInstrument): string[] {
  const raw = String(instrument.ticker || "").trim().toUpperCase();
  if (!raw) return null;
  if (raw.includes(".")) return raw;
  const exchange = String(instrument.exchange || "").toUpperCase();
  const suffixes: Array<[RegExp, string]> = [
    [/XETRA|XETR|FRANKFURT|DEUTSCHE B.RSE/, ".DE"], [/LSE|LONDON/, ".L"], [/AMS|AMSTERDAM/, ".AS"],
    [/MIL|XMIL|BORSA ITALIANA|MILAN|BIT/, ".MI"], [/PARIS|EURONEXT PARIS|EPA/, ".PA"], [/SWISS|SIX|ZURICH/, ".SW"],
    [/MADRID|BME|SPAIN/, ".MC"], [/BRUSSELS/, ".BR"], [/OSLO/, ".OL"], [/STOCKHOLM/, ".ST"],
    [/COPENHAGEN/, ".CO"], [/HELSINKI/, ".HE"], [/TORONTO|TSX/, ".TO"], [/AUSTRALIA|ASX|SYDNEY/, ".AX"],
    [/HONG KONG|HKEX/, ".HK"], [/TOKYO|JAPAN/, ".T"], [/NASDAQ|NYSE|NEW YORK|OTC/, ""]
  ];
  for (const [pattern, suffix] of suffixes) if (pattern.test(exchange)) return raw + suffix;
  return null;
}

export async function fetchYahooChart(instrument: YahooInstrument, range = "5d", interval = "1d"): Promise<YahooChart> {
  const symbol = yahooSymbol(instrument);
  if (!symbol) throw new Error("Ticker o borsa non riconosciuti: completa il ticker con il suffisso Yahoo corretto (es. .MI, .DE, .L).");
  const url = new URL("https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(symbol));
  url.searchParams.set("range", range);
  url.searchParams.set("interval", interval);
  url.searchParams.set("events", "div,splits");
  const response = await fetch(url, { cache: "no-store", headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; IlMioPercorsoETF/1.0)" }, signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error("Yahoo Finance non disponibile (HTTP " + response.status + ").");
  const payload: any = await response.json();
  if (payload?.chart?.error) throw new Error(String(payload.chart.error.description || "Yahoo Finance ha restituito un errore."));
  const result = payload?.chart?.result?.[0];
  if (!result) throw new Error("Nessun dato Yahoo Finance per " + symbol + ".");
  const meta = result.meta || {};
  const timestamps: number[] = Array.isArray(result.timestamp) ? result.timestamp : [];
  const closes: Array<number | null> = result.indicators?.adjclose?.[0]?.adjclose || result.indicators?.quote?.[0]?.close || [];
  const points = timestamps.map((time, i) => ({ date: new Date(time * 1000).toISOString().slice(0, 10), price: Number(closes[i]) })).filter(p => Number.isFinite(p.price) && p.price > 0);
  const price = Number(meta.regularMarketPrice ?? points.at(-1)?.price);
  if (!Number.isFinite(price) || price <= 0) throw new Error("Prezzo corrente non disponibile per " + symbol + ".");
  const quoteTimeSeconds = Number(meta.regularMarketTime || timestamps.at(-1) || 0);
  return { symbol, currency: String(meta.currency || instrument.currency || "EUR").toUpperCase(), price, quoteTime: quoteTimeSeconds ? new Date(quoteTimeSeconds * 1000).toISOString() : null, marketState: String(meta.marketState || "UNKNOWN").toUpperCase(), points };
}
