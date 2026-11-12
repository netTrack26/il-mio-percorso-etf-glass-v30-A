"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";

type AdminUser = {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
  account_status: "active" | "suspended";
  role: "admin" | "user";
};
type Dashboard = {
  total_users: number;
  new_users_7d: number;
  new_users_30d: number;
  active_users: number;
  suspended_users: number;
  users: AdminUser[];
};

const number = (value: number) => new Intl.NumberFormat("it-IT").format(value);

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    const run = async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        if (alive) { setError("Connessione Supabase non configurata."); setLoading(false); }
        return;
      }
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!alive) return;
      if (authError || !user) {
        setError("Accedi con l'account proprietario per aprire l'area amministratore.");
        setLoading(false);
        return;
      }
      setEmail(user.email ?? "");
      const { data, error: rpcError } = await supabase.rpc("admin_dashboard_data");
      if (!alive) return;
      if (rpcError) {
        setError(rpcError.code === "42501"
          ? "Il tuo account non ha ancora il ruolo amministratore. Completa l'attivazione indicata nel README del progetto."
          : "Area amministratore non ancora attiva. Verifica di aver applicato la migrazione 002_admin_foundation.sql su Supabase. Dettaglio: " + rpcError.message);
      } else {
        setDashboard(data as Dashboard);
      }
      setLoading(false);
    };
    void run();
    return () => { alive = false; };
  }, []);

  return (
    <main style={{minHeight:"100vh",padding:"28px clamp(16px,4vw,56px)",background:"radial-gradient(ellipse at 50% -15%,#45464d,#191a1f 58%,#101115)",color:"#f4f4f5",fontFamily:"Arial,sans-serif"}}>
      <div style={{maxWidth:1250,margin:"0 auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,flexWrap:"wrap",marginBottom:30}}>
          <div>
            <div style={{color:"#baf35e",fontSize:11,letterSpacing:2,fontWeight:700}}>IL MIO PERCORSO ETF</div>
            <h1 style={{fontSize:30,margin:"10px 0 5px"}}>Area amministratore</h1>
            <p style={{color:"#a5a6ad",fontSize:13,margin:0}}>Controllo iscritti e stato della piattaforma</p>
          </div>
          <Link href="/" style={{color:"#d2ff8a",textDecoration:"none",border:"1px solid #baf35e55",borderRadius:10,padding:"11px 15px",fontSize:12}}>← Torna alla piattaforma</Link>
        </div>

        {loading && <Panel>Caricamento dati amministrativi…</Panel>}
        {!loading && error && <Panel>
          <div style={{color:"#ffd27a",fontWeight:700,marginBottom:8}}>Accesso amministratore non attivo</div>
          <p style={{color:"#c5c6cc",fontSize:13,lineHeight:1.7,margin:0}}>{error}</p>
          <p style={{color:"#96979f",fontSize:12,lineHeight:1.7}}>Account collegato: {email || "non autenticato"}. Nessun dato degli altri utenti viene mostrato senza autorizzazione lato database.</p>
        </Panel>}

        {dashboard && <>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:14,marginBottom:18}}>
            <Kpi label="Utenti iscritti" value={dashboard.total_users}/>
            <Kpi label="Nuovi · ultimi 7 giorni" value={dashboard.new_users_7d}/>
            <Kpi label="Nuovi · ultimi 30 giorni" value={dashboard.new_users_30d}/>
            <Kpi label="Account attivi" value={dashboard.active_users}/>
            <Kpi label="Account sospesi" value={dashboard.suspended_users}/>
          </div>
          <Panel>
            <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap",marginBottom:15}}>
              <div><h2 style={{fontSize:17,margin:"0 0 5px"}}>Utenti registrati</h2><p style={{fontSize:12,color:"#a5a6ad",margin:0}}>Elenco degli ultimi 100 account</p></div>
              <span style={{fontSize:11,color:"#cfff80",border:"1px solid #baf35e38",padding:"7px 10px",borderRadius:8}}>PROPRIETARIO · {email}</span>
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",textAlign:"left",fontSize:12}}>
                <thead><tr>{["UTENTE","REGISTRAZIONE","RUOLO","STATO"].map(x=><th key={x} style={{padding:"12px 9px",borderBottom:"1px solid #ffffff25",color:"#a5a6ad",fontSize:10}}>{x}</th>)}</tr></thead>
                <tbody>{dashboard.users.map(user=><tr key={user.id}>
                  <td style={{padding:"13px 9px",borderBottom:"1px solid #ffffff14"}}><b>{user.display_name || "Utente"}</b><div style={{color:"#a5a6ad",marginTop:4}}>{user.email}</div></td>
                  <td style={{padding:"13px 9px",borderBottom:"1px solid #ffffff14",whiteSpace:"nowrap"}}>{new Date(user.created_at).toLocaleDateString("it-IT")}</td>
                  <td style={{padding:"13px 9px",borderBottom:"1px solid #ffffff14"}}>{user.role === "admin" ? "Amministratore" : "Utente"}</td>
                  <td style={{padding:"13px 9px",borderBottom:"1px solid #ffffff14",color:user.account_status === "active" ? "#cfff80" : "#ffaaaa"}}>{user.account_status === "active" ? "Attivo" : "Sospeso"}</td>
                </tr>)}</tbody>
              </table>
            </div>
          </Panel>
        </>}
        <p style={{color:"#73757e",fontSize:11,marginTop:22}}>Area riservata. I dati sono forniti da Supabase e restituiti soltanto dopo la verifica del ruolo amministratore.</p>
      </div>
    </main>
  );
}

function Panel({children}:{children:React.ReactNode}) {
  return <section style={{padding:22,border:"1px solid #ffffff25",borderRadius:18,background:"linear-gradient(145deg,#55565c88,#222328bb)",boxShadow:"0 18px 45px #0005"}}>{children}</section>;
}
function Kpi({label,value}:{label:string;value:number}) {
  return <Panel><div style={{fontSize:11,color:"#b9bac0",marginBottom:14}}>{label}</div><div style={{fontSize:30,fontWeight:800,color:"#d2ff8a"}}>{number(value)}</div></Panel>;
}
