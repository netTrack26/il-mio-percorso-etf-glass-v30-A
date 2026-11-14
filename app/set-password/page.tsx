"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";

export default function SetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function savePassword() {
    if (password.length < 8) { setMessage("La password deve contenere almeno 8 caratteri."); return; }
    if (password !== confirm) { setMessage("Le password non coincidono."); return; }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setMessage("Servizio di accesso non configurato."); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { setMessage("Non è stato possibile impostare la password. Riapri il link ricevuto via email."); return; }
    router.replace("/");
    router.refresh();
  }

  return (
    <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:24,background:"#090b0a",color:"#f5f7f4"}}>
      <section style={{width:"100%",maxWidth:440,padding:28,border:"1px solid #293128",borderRadius:18,background:"#111612"}}>
        <div style={{color:"#baf35e",fontSize:12,letterSpacing:2,fontWeight:700}}>IL MIO PERCORSO ETF</div>
        <h1 style={{fontSize:28,margin:"18px 0 8px"}}>Imposta la password</h1>
        <p style={{color:"#aab3a8",lineHeight:1.5}}>Completa l’attivazione del tuo account Beta scegliendo una password personale.</p>
        <label style={{display:"block",marginTop:22,fontSize:13}}>Nuova password
          <input type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} style={{display:"block",width:"100%",marginTop:8,padding:13,borderRadius:9,border:"1px solid #39443a",background:"#090d0a",color:"white"}}/>
        </label>
        <label style={{display:"block",marginTop:16,fontSize:13}}>Conferma password
          <input type="password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} style={{display:"block",width:"100%",marginTop:8,padding:13,borderRadius:9,border:"1px solid #39443a",background:"#090d0a",color:"white"}}/>
        </label>
        {message && <p role="alert" style={{color:"#ffb4a9",fontSize:13}}>{message}</p>}
        <button onClick={savePassword} disabled={busy} style={{width:"100%",marginTop:22,padding:14,border:0,borderRadius:9,background:"#baf35e",color:"#10150c",fontWeight:700}}>{busy?"Salvataggio…":"Attiva account"}</button>
      </section>
    </main>
  );
}
