import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const inviteCode = typeof body?.inviteCode === "string" ? body.inviteCode.trim() : "";
    const legalAccepted = body?.legalAccepted === true;
    if (!legalAccepted) return NextResponse.json({ error: "Conferma prima Termini e Informativa Privacy." }, { status: 400 });
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) return NextResponse.json({ error: "Inserisci un indirizzo email valido." }, { status: 400 });
    if (password.length < 8 || password.length > 128) return NextResponse.json({ error: "La password deve contenere almeno 8 caratteri." }, { status: 400 });
    const expectedCode = process.env.BETA_INVITE_CODE?.trim();
    if (!expectedCode) return NextResponse.json({ error: "Registrazioni momentaneamente non disponibili." }, { status: 503 });
    if (!inviteCode || inviteCode.length > 128 || inviteCode !== expectedCode) return NextResponse.json({ error: "Codice Telegram non valido." }, { status: 403 });
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "");
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!url || !key) return NextResponse.json({ error: "Servizio di registrazione non configurato." }, { status: 503 });
    const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { legal_accepted: true } });
    if (error) {
      const exists = /already|registered|exists/i.test(error.message);
      console.error("[account-signup] createUser failed:", { status: error.status, message: error.message });
      return NextResponse.json({ error: exists ? "Esiste già un account con questa email. Accedi dalla scheda Accedi." : "Non è stato possibile creare l’account. Verifica i dati e riprova." }, { status: 400 });
    }
    return NextResponse.json({ ok: true, userId: data.user.id });
  } catch (error) {
    console.error("[account-signup] Unexpected error:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Errore temporaneo durante la registrazione." }, { status: 500 });
  }
}
