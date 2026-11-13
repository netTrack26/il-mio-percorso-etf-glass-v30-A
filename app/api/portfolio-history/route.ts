import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";
const BASE = "https://etfcompare.eu";

async function requireUser() {
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
  if (error || !data.user) return false;
  return true;
}

type Point = { date: string; price: number };
type PositionHistory = { isin: string; quantity: number; points: Point[] };
function parsePoints(payload: any): Point[] {
  const found: Point[] = [];
  const visit = (value: any): void => {
    if (Array.isArray(value)) {
      if (value.length >= 2 && (typeof value[0] === "number" || typeof value[0] === "string") && Number.isFinite(Number(value[1]))) {
        const raw = value[0];
        const date = typeof raw === "number"
          ? new Date(raw < 1e12 ? raw * 1000 : raw).toISOString().slice(0, 10)
          : (Number.isFinite(Date.parse(raw)) ? new Date(raw).toISOString().slice(0, 10) : "");
        if (date && Number(value[1]) > 0) found.push({ date, price: Number(value[1]) });
      } else value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;
    const obj = value as Record<string, any>;
    const rawDate = obj.date ?? obj.datetime ?? obj.timestamp ?? obj.time ?? obj.t;
    const rawPrice = obj.price ?? obj.close ?? obj.value ?? obj.nav ?? obj.p;
    if (rawDate != null && Number.isFinite(Number(rawPrice)) && Number(rawPrice) > 0) {
      const date = typeof rawDate === "number"
        ? new Date(rawDate < 1e12 ? rawDate * 1000 : rawDate).toISOString().slice(0, 10)
        : (Number.isFinite(Date.parse(String(rawDate))) ? new Date(String(rawDate)).toISOString().slice(0, 10) : "");
      if (date) found.push({ date, price: Number(rawPrice) });
    }
    Object.values(obj).forEach(child => { if (child && typeof child === "object") visit(child); });
  };
  visit(payload);
  return [...new Map(found.map(p => [p.date, p])).values()].sort((a, b) => a.date.localeCompare(b.date));
}

export async function POST(request: NextRequest) {
  try {
    if (!(await requireUser())) return NextResponse.json({ error: "Accesso richiesto." }, { status: 401 });
    const body = await request.json();
    const positions = Array.isArray(body.positions) ? body.positions.slice(0, 30) : [];
    if (!positions.length) return NextResponse.json({ error: "Nessuna posizione da analizzare." }, { status: 400 });
    const valid = positions.map((p: any) => ({ isin: String(p.isin || "").toUpperCase(), quantity: Number(p.quantity) }))
      .filter((p: any) => /^[A-Z]{2}[A-Z0-9]{10}$/.test(p.isin) && Number.isFinite(p.quantity) && p.quantity > 0);
    if (!valid.length || valid.length !== positions.length) return NextResponse.json({ error: "Le posizioni inviate non sono valide." }, { status: 400 });

    const histories: PositionHistory[] = await Promise.all(valid.map(async (position: { isin: string; quantity: number }): Promise<PositionHistory> => {
      const response = await fetch(BASE + "/api/price?isin=" + encodeURIComponent(position.isin) + "&range=1y", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || payload?.error) throw new Error(payload?.error || "Storico prezzi non disponibile per " + position.isin + ".");
      const points = parsePoints(payload);
      if (!points.length) throw new Error("Il provider non ha restituito prezzi storici utilizzabili per " + position.isin + ".");
      const currency = String(payload?.currency || payload?.data?.currency || payload?.meta?.currency || "EUR").toUpperCase();
      if (currency !== "EUR") throw new Error("La serie di " + position.isin + " è in " + currency + ": conversione EUR non disponibile, quindi il totale aggregato non sarebbe affidabile.");
      return { ...position, points };
    }));

    const dates = [...new Set(histories.flatMap(h => h.points.map(p => p.date)))].sort();
    const latest = new Array(histories.length).fill(null) as (number | null)[];
    const cursors = new Array(histories.length).fill(0);
    const output: { date: string; value: number }[] = [];
    for (const date of dates) {
      histories.forEach((h, index) => {
        while (cursors[index] < h.points.length && h.points[cursors[index]].date <= date) {
          latest[index] = h.points[cursors[index]].price;
          cursors[index]++;
        }
      });
      if (latest.every((p): p is number => p !== null)) {
        const value = histories.reduce((sum, h, index) => sum + h.quantity * (latest[index] as number), 0);
        output.push({ date, value: Number(value.toFixed(2)) });
      }
    }
    if (output.length < 2) return NextResponse.json({ error: "Lo storico comune dei tuoi ETF non contiene ancora abbastanza rilevazioni." }, { status: 422 });
    return NextResponse.json({ points: output, source: "ETF Compare", currency: "EUR", asOf: output[output.length - 1].date }, {
      headers: { "Cache-Control": "private, max-age=300" }
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Storico di mercato temporaneamente non disponibile." }, { status: 503 });
  }
}
