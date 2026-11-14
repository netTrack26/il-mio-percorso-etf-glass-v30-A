import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const inviteCode = typeof body?.inviteCode === "string" ? body.inviteCode.trim() : "";
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) {
      return NextResponse.json({ error: "Inserisci un indirizzo email valido." }, { status: 400 });
    }
    const expectedCode = process.env.BETA_INVITE_CODE;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!expectedCode || !supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Inviti Beta non ancora configurati sul server." }, { status: 503 });
    }
    if (!inviteCode || inviteCode.length > 128 || inviteCode !== expectedCode) {
      return NextResponse.json({ error: "Codice invito non valido." }, { status: 403 });
    }
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const redirectTo = new URL("/auth/callback?next=/set-password", request.nextUrl.origin).toString();
    const { error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: {
        legal_terms_version: "2026-11-14",
        privacy_notice_version: "2026-11-14",
        legal_accepted_at: new Date().toISOString(),
        beta_invited: true
      }
    });
    if (error) {
      const message = /already|registered|exists/i.test(error.message)
        ? "Esiste già un account con questa email. Prova ad accedere."
        : "Non è stato possibile inviare l’invito. Riprova più tardi.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Errore durante la richiesta di invito." }, { status: 500 });
  }
}
