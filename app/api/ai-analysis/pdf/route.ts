import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import PDFDocument from "pdfkit";

export const runtime = "nodejs";

async function authenticated() {
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
  return error || !data.user ? null : data.user;
}

function clean(value: unknown, max = 100000): string {
  return typeof value === "string" ? value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, max).trim() : "";
}
function euro(value: unknown): string {
  const n = Number(value);
  return Number.isFinite(n) ? new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n) : "n.d.";
}
function section(doc: PDFKit.PDFDocument, title: string, text: string) {
  if (!text) return;
  if (doc.y > 700) doc.addPage();
  doc.x = 48;
  doc.moveDown(0.7);
  doc.x = 48;
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#91BD42").text(title.toUpperCase(), { width: 500, continued: false });
  doc.moveDown(0.25);
  doc.x = 48;
  doc.font("Helvetica").fontSize(9.2).fillColor("#29313A").text(text, { width: 500, lineGap: 3, paragraphGap: 4, align: "left" });
  doc.moveDown(0.35);
}
function bulletSection(doc: PDFKit.PDFDocument, title: string, items: unknown[]) {
  if (!items.length) return;
  if (doc.y > 700) doc.addPage();
  doc.x = 48;
  doc.moveDown(0.7);
  doc.x = 48;
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#91BD42").text(title.toUpperCase(), { width: 500 });
  doc.moveDown(0.25);
  items.forEach((item) => {
    const text = clean(item, 100000);
    if (!text) return;
    if (doc.y > 735) doc.addPage();
    doc.x = 48;
    doc.font("Helvetica").fontSize(9.1).fillColor("#29313A")
      .text("•  " + text, { width: 500, lineGap: 2, paragraphGap: 3, indent: 0 });
    doc.moveDown(0.18);
  });
}
function addMetric(doc: PDFKit.PDFDocument, x: number, y: number, width: number, label: string, value: string, accent = false) {
  doc.roundedRect(x, y, width, 57, 7).fill(accent ? "#EFF7E5" : "#F1F3F5");
  doc.font("Helvetica-Bold").fontSize(7).fillColor("#65707A").text(label.toUpperCase(), x + 9, y + 9, { width: width - 18 });
  doc.font("Helvetica-Bold").fontSize(13).fillColor(accent ? "#4D7520" : "#1B2229").text(value, x + 9, y + 28, { width: width - 18 });
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticated();
    if (!user) return NextResponse.json({ error: "Accedi per scaricare il report del tuo account." }, { status: 401 });
    const body: any = await request.json().catch(() => null);
    if (!body || JSON.stringify(body).length > 100000) return NextResponse.json({ error: "Dati del report non validi o troppo grandi." }, { status: 400 });
    const report = body.report;
    const facts = body.facts;
    const required = ["executiveSummary","portfolioComposition","performance","diversification","overlap","geographicExposure","sectorExposure","costsAndFees","pacAnalysis","quoteQuality","riskAssessment","methodology","limitations"];
    const completeSentence = (value: unknown) => {
      const text = clean(value);
      return text.length > 0 && /[.!?…]["'»”’)]*$/.test(text);
    };
    if (!report || !facts || required.some(key => !completeSentence(report[key]))) {
      return NextResponse.json({ error: "Il report contiene una sezione mancante o una frase non conclusa. Rigenera l'analisi prima di esportare." }, { status: 400 });
    }
    if (!Array.isArray(report.strengths) || report.strengths.length < 2 || report.strengths.some((item: unknown) => !completeSentence(item))) {
      return NextResponse.json({ error: "I punti di forza non sono completi. Rigenera l'analisi prima di esportare." }, { status: 400 });
    }
    if (!Array.isArray(report.monitoringItems) || report.monitoringItems.length < 3 || report.monitoringItems.some((item: unknown) => !completeSentence(item))) {
      return NextResponse.json({ error: "Gli elementi da monitorare non sono completi. Rigenera l'analisi prima di esportare." }, { status: 400 });
    }
    if (!Array.isArray(report.verificationActions) || report.verificationActions.length !== 3 || report.verificationActions.some((item: unknown) => !completeSentence(item))) {
      return NextResponse.json({ error: "Le tre verifiche pratiche non sono complete. Rigenera l'analisi prima di esportare." }, { status: 400 });
    }
    const holdings = Array.isArray(facts.holdings) ? facts.holdings.slice(0, 50) : [];
    const generatedAt = clean(body.generatedAt, 80) || new Date().toISOString();
    const generatedDate = new Date(generatedAt);
    const dateLabel = Number.isNaN(generatedDate.getTime()) ? new Date().toLocaleString("it-IT") : generatedDate.toLocaleString("it-IT", { timeZone: "Europe/Rome" });

    const doc = new PDFDocument({ size: "A4", margins: { top: 46, bottom: 48, left: 48, right: 48 }, bufferPages: true, compress: true });
    const chunks: Buffer[] = [];
    const pdfPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on("data", chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });
    doc.info = {
      Title: "Il Mio Percorso ETF - Report AI del portafoglio",
      Author: "Il Mio Percorso ETF",
      Subject: "Analisi informativa del portafoglio ETF",
      CreationDate: Number.isNaN(generatedDate.getTime()) ? new Date() : generatedDate
    };

    // Cover/header
    doc.rect(0, 0, doc.page.width, 132).fill("#171C22");
    doc.rect(48, 42, 4, 54).fill("#B8EC65");
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#C8F18A").text("IL MIO PERCORSO ETF  /  PORTFOLIO INTELLIGENCE", 64, 43);
    doc.font("Helvetica-Bold").fontSize(23).fillColor("#FFFFFF").text("Report completo del portafoglio", 64, 61, { width: 465 });
    doc.font("Helvetica").fontSize(9).fillColor("#CCD3DA").text("Generato il " + dateLabel + "  ·  Analisi AI + calcoli quantitativi interni", 64, 100);
    doc.y = 151;

    const invested = euro(facts.invested);
    const current = euro(facts.currentValue);
    const pnl = euro(facts.unrealizedResult);
    const pnlPct = Number.isFinite(Number(facts.unrealizedResultPercent)) ? Number(facts.unrealizedResultPercent).toFixed(2).replace(".", ",") + "%" : "n.d.";
    const gap = 9;
    const col = (doc.page.width - 96 - gap * 3) / 4;
    const y = doc.y;
    addMetric(doc, 48, y, col, "Capitale ricostruito", invested);
    addMetric(doc, 48 + col + gap, y, col, "Valore stimato", current, true);
    addMetric(doc, 48 + (col + gap) * 2, y, col, "Risultato", pnl + " (" + pnlPct + ")");
    addMetric(doc, 48 + (col + gap) * 3, y, col, "ETF attivi", String(holdings.length));
    doc.x = 48;
    doc.y = y + 75;
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#4D5964").text(
      "ATTENZIONE: il capitale ricostruito è calcolato usando quantità e prezzi di carico inseriti o modificati dall'utente. Non certifica i versamenti realmente effettuati né costituisce uno storico degli acquisti.",
      { width: 500, lineGap: 2 }
    );
    doc.moveDown(0.45);
    doc.x = 48;
    const terLabel = facts.weightedTerPercent === null || facts.weightedTerPercent === undefined
      ? "TER ponderato: non disponibile"
      : "TER ponderato indicativo: " + Number(facts.weightedTerPercent).toFixed(3).replace(".", ",") + "%";
    doc.font("Helvetica").fontSize(8).fillColor("#5B6570").text(
      "PAC mensile equivalente: " + euro(facts.activePacMonthlyEquivalent) +
      "  |  Quotazioni recenti: " + Number(facts.liveQuoteCount || 0) + "/" + holdings.length +
      "  |  " + terLabel +
      "  |  Copertura TER per peso: " + Number(facts.terCoverageWeightPercent || 0).toFixed(1).replace(".", ",") + "%",
      { width: 500 }
    );
    doc.moveDown(0.6);

    doc.x = 48;
    section(doc, "Sintesi esecutiva", clean(report.executiveSummary));
    section(doc, "Composizione del portafoglio", clean(report.portfolioComposition));
    if (holdings.length) {
      if (doc.y > 650) doc.addPage();
      doc.x = 48;
      doc.moveDown(0.25);
      doc.x = 48;
      doc.font("Helvetica-Bold").fontSize(11).fillColor("#91BD42").text("POSIZIONI E QUOTAZIONI", { width: 500 });
      doc.moveDown(0.35);
      holdings.forEach((h:any) => {
        if (doc.y > 735) doc.addPage();
        doc.x = 48;
        const quote = h.quote || {};
        const weight = Number.isFinite(Number(h.weight)) ? Number(h.weight).toFixed(2).replace(".", ",") + "%" : "n.d.";
        const ter = h.ter === null || h.ter === undefined ? "TER n.d." : "TER " + String(h.ter).replace(".", ",") + "%";
        doc.x = 48;
        doc.font("Helvetica-Bold").fontSize(9.3).fillColor("#202830").text(clean(h.ticker, 32) + "  ·  " + clean(h.name, 180), { width: 500 });
        doc.x = 48;
        doc.font("Helvetica").fontSize(8).fillColor("#5B6570").text("ISIN " + clean(h.isin, 20) + "  |  Peso " + weight + "  |  Valore " + euro(h.currentValue) + "  |  Investito " + euro(h.invested) + "  |  " + ter, { width: 500 });
        const quoteStatus = quote.freshness === "fresh" ? "timestamp recente" : quote.freshness === "delayed" ? "quotazione datata" : "prezzo non disponibile";
        const fxLabel = quote.fxRate === null || quote.fxRate === undefined
          ? "cambio n.d."
          : "1 " + clean(quote.originalCurrency || "EUR") + " = " + Number(quote.fxRate).toFixed(6) + " EUR";
        doc.x = 48;
        doc.font("Helvetica").fontSize(8).fillColor("#5B6570").text("Fonte: " + clean(quote.source || "n.d.") + " · Simbolo: " + clean(quote.symbol || "n.d.") + " · " + quoteStatus + " · " + (quote.time ? new Date(quote.time).toLocaleString("it-IT", { timeZone: "Europe/Rome" }) : "nessun timestamp") + " · " + fxLabel, { width: 500 });
        doc.moveDown(0.45);
      });
    }
    section(doc, "Risultato e performance", clean(report.performance));
    section(doc, "Diversificazione", clean(report.diversification));
    section(doc, "Sovrapposizioni tra ETF", clean(report.overlap));
    section(doc, "Esposizione geografica", clean(report.geographicExposure));
    section(doc, "Esposizione settoriale", clean(report.sectorExposure));
    section(doc, "Costi e commissioni", clean(report.costsAndFees));
    section(doc, "Analisi dei piani PAC", clean(report.pacAnalysis));
    section(doc, "Qualità e freschezza dei prezzi", clean(report.quoteQuality));
    section(doc, "Rischi e punti di attenzione", clean(report.riskAssessment));
    bulletSection(doc, "Punti di forza supportati dai dati", Array.isArray(report.strengths) ? report.strengths : []);
    bulletSection(doc, "Elementi da monitorare", Array.isArray(report.monitoringItems) ? report.monitoringItems : []);
    bulletSection(doc, "Tre verifiche pratiche", report.verificationActions);
    section(doc, "Metodologia", clean(report.methodology));
    section(doc, "Limiti dell'analisi", clean(report.limitations));
    section(doc, "Nota informativa", clean(body.disclaimer, 5000) || "Documento informativo, non costituisce consulenza finanziaria personalizzata né raccomandazione di acquisto o vendita.");

    // Add a page footer and page number on every buffered page.
    // Footer sits below the content area: disable the normal bottom-margin
    // page-break check while drawing it, otherwise PDFKit appends blank pages.
    const range = doc.bufferedPageRange();
    const originalBottomMargin = doc.page.margins.bottom;
    for (let index = range.start; index < range.start + range.count; index++) {
      doc.switchToPage(index);
      doc.page.margins.bottom = 0;
      doc.font("Helvetica").fontSize(7).fillColor("#7C858E")
        .text("Il Mio Percorso ETF  ·  Dati personali del portafoglio  ·  Pagina " + (index + 1) + " di " + range.count, 48, doc.page.height - 31, { width: doc.page.width - 96, align: "center", lineBreak: false });
      doc.page.margins.bottom = originalBottomMargin;
    }
    doc.end();
    const buffer = await pdfPromise;
    const filename = "il-mio-percorso-etf-report-ai-" + (Number.isNaN(generatedDate.getTime()) ? "report" : generatedDate.toISOString().slice(0,10)) + ".pdf";
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="' + filename + '"',
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Generazione PDF non riuscita." }, { status: 503 });
  }
}
