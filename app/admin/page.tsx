"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";

type AdminUser = { id:string; email:string; display_name:string; created_at:string; account_status:"active"|"suspended"; role:"admin"|"user" };
type ETF = { isin:string; ticker:string; name:string; issuer:string; currency:string; ongoing_charges:number|null };
type Day = { day:string; count:number };
type Premium = { enabled:boolean; label:string; description:string };
type Dashboard = { total_users:number; new_users_7d:number; new_users_30d:number; active_users:number; suspended_users:number; users:AdminUser[]; catalog:ETF[]; signups_30d:Day[]; premium:Premium };

const panel:React.CSSProperties={padding:20,border:"1px solid #ffffff24",borderRadius:17,background:"linear-gradient(145deg,#51525a88,#222328cc)",boxShadow:"0 15px 40px #0004"};
const field:React.CSSProperties={width:"100%",padding:"11px 12px",border:"1px solid #ffffff25",borderRadius:9,background:"#111216",color:"#fff",fontSize:13};
const button=(primary=false):React.CSSProperties=>({padding:"10px 13px",borderRadius:9,border:primary?"1px solid #d5ff89":"1px solid #ffffff25",background:primary?"linear-gradient(130deg,#d5ff89,#a8e64c)":"#ffffff0a",color:primary?"#1b240e":"#e9e9eb",fontWeight:700,fontSize:12,cursor:"pointer"});
const fmt=(n:number)=>new Intl.NumberFormat("it-IT").format(n);
const errText=(e:any)=>e?.message||"Operazione non riuscita";

export default function AdminPage(){
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[email,setEmail]=useState(""),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [data,setData]=useState<Dashboard|null>(null),[search,setSearch]=useState(""),[tab,setTab]=useState<"overview"|"users"|"catalog"|"premium">("overview");
 const [etf,setEtf]=useState<ETF>({isin:"",ticker:"",name:"",issuer:"",currency:"EUR",ongoing_charges:null});
 const [editing,setEditing]=useState(false),[premiumEnabled,setPremiumEnabled]=useState(false),[premiumLabel,setPremiumLabel]=useState("In arrivo"),[premiumDescription,setPremiumDescription]=useState("Funzioni avanzate in preparazione");

 const load=useCallback(async()=>{
   try {
   const sb=getSupabaseBrowserClient(); if(!sb){setError("Connessione Supabase non configurata.");setLoading(false);return;}
   const {data:{user},error:authError}=await sb.auth.getUser();
   if(authError||!user){setError("Accedi con il tuo account amministratore.");setLoading(false);return;}
   setEmail(user.email||"");
   const {data:result,error:rpcError}=await sb.rpc("admin_dashboard_data");
   if(rpcError){setError(rpcError.code==="42501"?"Il tuo account non dispone dei privilegi amministratore.":"Non riesco a leggere la dashboard. Verifica di aver eseguito la migrazione 003_admin_management.sql. "+rpcError.message);setLoading(false);return;}
   const raw=(result&&typeof result==="object"?result:{}) as Partial<Dashboard>;
   const d:Dashboard={
    total_users:Number(raw.total_users)||0,
    new_users_7d:Number(raw.new_users_7d)||0,
    new_users_30d:Number(raw.new_users_30d)||0,
    active_users:Number(raw.active_users)||0,
    suspended_users:Number(raw.suspended_users)||0,
    users:Array.isArray(raw.users)?raw.users:[],
    catalog:Array.isArray(raw.catalog)?raw.catalog:[],
    signups_30d:Array.isArray(raw.signups_30d)?raw.signups_30d:[],
    premium:raw.premium&&typeof raw.premium==="object"?raw.premium:{enabled:false,label:"In arrivo",description:"Funzioni avanzate in preparazione"}
   };
   setData(d);setPremiumEnabled(!!d.premium.enabled);setPremiumLabel(d.premium.label||"In arrivo");setPremiumDescription(d.premium.description||"Funzioni avanzate in preparazione");setError("");setLoading(false);
   } catch(e) { setError("Errore durante il caricamento: "+errText(e));setLoading(false); }
 },[]);
 useEffect(()=>{void load();},[load]);

 const filtered=useMemo(()=>Array.isArray(data?.users)?data!.users.filter(u=>((u?.email||"")+" "+(u?.display_name||"")).toLowerCase().includes(search.toLowerCase())):[],[data,search]);
 const action=async(fn:string,args:Record<string,any>,success:string)=>{
   const sb=getSupabaseBrowserClient();if(!sb){setNotice("Errore: connessione Supabase non disponibile.");return;}
   setBusy(true);setNotice("");
   try {
    const {error:e}=await sb.rpc(fn,args);
    if(e){setNotice("Errore: "+errText(e));return;}
    setNotice(success);await load();
   } catch(e) { setNotice("Errore: "+errText(e)); }
   finally { setBusy(false); }
 };
 const saveETF=async()=>{
   if(!etf.isin||!etf.ticker||!etf.name){setNotice("Inserisci ISIN, ticker e nome.");return;}
   const ter=etf.ongoing_charges===null||String(etf.ongoing_charges)===""?null:Number(etf.ongoing_charges);
   if(ter!==null&&(!Number.isFinite(ter)||ter<0)){setNotice("TER non valido.");return;}
   await action("admin_upsert_etf",{p_isin:etf.isin.toUpperCase().trim(),p_ticker:etf.ticker.toUpperCase().trim(),p_name:etf.name.trim(),p_issuer:etf.issuer||null,p_currency:etf.currency||null,p_ter:ter},"ETF salvato nel catalogo condiviso.");
   setEtf({isin:"",ticker:"",name:"",issuer:"",currency:"EUR",ongoing_charges:null});setEditing(false);
 };
 const savePremium=async()=>action("admin_set_premium",{p_enabled:premiumEnabled,p_label:premiumLabel,p_description:premiumDescription},"Impostazioni Premium salvate.");

 const signupDays=Array.isArray(data?.signups_30d)?data!.signups_30d:[];
 const catalogItems=Array.isArray(data?.catalog)?data!.catalog:[];
 const maxSignup=Math.max(1,...signupDays.map(x=>Number(x?.count)||0));
 return <main style={{minHeight:"100vh",padding:"26px clamp(14px,4vw,54px)",background:"radial-gradient(ellipse at 50% -15%,#45464d,#191a1f 58%,#101115)",color:"#f4f4f5",fontFamily:"Arial,sans-serif"}}>
  <div style={{maxWidth:1400,margin:"0 auto"}}>
   <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:14,flexWrap:"wrap",marginBottom:24}}>
    <div><div style={{color:"#baf35e",fontSize:11,letterSpacing:2,fontWeight:700}}>IL MIO PERCORSO ETF · CONTROL ROOM</div><h1 style={{fontSize:29,margin:"9px 0 5px"}}>Amministrazione</h1><p style={{fontSize:12,color:"#a5a6ad",margin:0}}>Gestione iscritti, catalogo ETF e servizi Premium</p></div>
    <div style={{display:"flex",gap:9,alignItems:"center",flexWrap:"wrap"}}><span style={{fontSize:11,color:"#cfff80",border:"1px solid #baf35e38",padding:"9px 11px",borderRadius:9}}>PROPRIETARIO · {email}</span><Link href="/" style={{...button(),textDecoration:"none"}}>← Piattaforma</Link></div>
   </header>
   {notice&&<div role="status" style={{...panel,padding:12,marginBottom:14,color:notice.startsWith("Errore")?"#ffaaaa":"#d5ff89",fontSize:12}}>{notice}</div>}
   {loading&&<div style={panel}>Caricamento dati amministrativi…</div>}
   {!loading&&error&&<div style={panel}><b style={{color:"#ffd27a"}}>Accesso non disponibile</b><p style={{fontSize:13,lineHeight:1.7,color:"#c5c6cc"}}>{error}</p><button style={button()} onClick={()=>{setLoading(true);void load();}}>Riprova</button></div>}
   {data&&<>
    <nav style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:13,marginBottom:8}}>
     {([["overview","Panoramica"],["users","Utenti"],["catalog","Catalogo ETF"],["premium","Premium"]] as const).map(([id,label])=><button key={id} onClick={()=>setTab(id)} style={{...button(tab===id),whiteSpace:"nowrap"}}>{label}</button>)}
    </nav>
    {tab==="overview"&&<>
     <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))",gap:12,marginBottom:15}}>
      <Kpi label="Utenti iscritti" value={data.total_users}/><Kpi label="Nuovi · 7 giorni" value={data.new_users_7d}/><Kpi label="Nuovi · 30 giorni" value={data.new_users_30d}/><Kpi label="Account attivi" value={data.active_users}/><Kpi label="Account sospesi" value={data.suspended_users}/><Kpi label="ETF in catalogo" value={catalogItems.length}/>
     </div>
     <section style={panel}><h2 style={{fontSize:16,margin:"0 0 4px"}}>Nuove iscrizioni · ultimi 30 giorni</h2><p style={{fontSize:11,color:"#a5a6ad",margin:"0 0 18px"}}>Registrazioni giornaliere effettive da Supabase</p>
      <div style={{height:170,display:"flex",alignItems:"end",gap:3,overflowX:"auto",paddingBottom:5}}>
       {signupDays.map(d=><div key={d.day} title={new Date(d.day).toLocaleDateString("it-IT")+": "+d.count} style={{height:"100%",minWidth:7,flex:"1 0 7px",display:"flex",alignItems:"end"}}><div style={{width:"100%",height:Math.max(d.count?7:2,d.count/maxSignup*100)+"%",borderRadius:"4px 4px 1px 1px",background:d.count?"linear-gradient(180deg,#d7ff91,#8dc83d)":"#ffffff18"}}/></div>)}
      </div><div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#999ba3"}}><span>{signupDays[0]?.day}</span><span>{signupDays[signupDays.length-1]?.day}</span></div>
     </section>
     <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:12,marginTop:14}}>
      <section style={panel}><h3 style={{margin:"0 0 8px",fontSize:14}}>Gestione utenti</h3><p style={{fontSize:12,color:"#a5a6ad"}}>Cerca iscritti, cambia ruolo e gestisci gli account sospesi.</p><button style={button(true)} onClick={()=>setTab("users")}>Apri utenti →</button></section>
      <section style={panel}><h3 style={{margin:"0 0 8px",fontSize:14}}>Catalogo ETF</h3><p style={{fontSize:12,color:"#a5a6ad"}}>Gestisci gli strumenti condivisi, senza eliminare quelli già usati nei portafogli.</p><button style={button(true)} onClick={()=>setTab("catalog")}>Gestisci catalogo →</button></section>
      <section style={panel}><h3 style={{margin:"0 0 8px",fontSize:14}}>Premium</h3><p style={{fontSize:12,color:"#a5a6ad"}}>Prepara il livello a pagamento senza attivare incassi o abbonamenti.</p><button style={button(true)} onClick={()=>setTab("premium")}>Configura Premium →</button></section>
     </div>
    </>}
    {tab==="users"&&<section style={panel}>
     <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap",alignItems:"center"}}><div><h2 style={{fontSize:17,margin:"0 0 4px"}}>Gestione utenti</h2><p style={{fontSize:11,color:"#a5a6ad",margin:0}}>Ultimi 500 account · {filtered.length} risultati</p></div><input style={{...field,maxWidth:330}} placeholder="Cerca per email o nome…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
     <div style={{overflowX:"auto",marginTop:16}}><table style={{width:"100%",borderCollapse:"collapse",textAlign:"left",fontSize:12,minWidth:680}}><thead><tr>{["UTENTE","ISCRIZIONE","RUOLO","STATO","AZIONI"].map(x=><th key={x} style={th}>{x}</th>)}</tr></thead><tbody>
      {filtered.map(u=><tr key={u.id}><td style={td}><b>{u.display_name||"Utente"}</b><div style={{color:"#a5a6ad",marginTop:4}}>{u.email}</div></td><td style={td}>{new Date(u.created_at).toLocaleDateString("it-IT")}</td><td style={td}><select aria-label={"Ruolo "+u.email} value={u.role} disabled={busy||u.email.toLowerCase()===email.toLowerCase()} onChange={e=>{if(confirm("Confermi la modifica del ruolo di "+u.email+"?"))void action("admin_set_user_role",{target_user:u.id,new_role:e.target.value},"Ruolo aggiornato.");}} style={field}><option value="user">Utente</option><option value="admin">Amministratore</option></select></td><td style={{...td,color:u.account_status==="active"?"#cfff80":"#ffaaaa"}}>{u.account_status==="active"?"Attivo":"Sospeso"}</td><td style={td}>{u.email.toLowerCase()===email.toLowerCase()?<span style={{color:"#a5a6ad"}}>Proprietario</span>:<button disabled={busy} style={button(u.account_status==="suspended")} onClick={()=>{const next=u.account_status==="active"?"suspended":"active";if(confirm((next==="suspended"?"Sospendere":"Riattivare")+" l'account "+u.email+"?"))void action("admin_set_user_status",{target_user:u.id,new_status:next},next==="suspended"?"Account sospeso.":"Account riattivato.");}}>{u.account_status==="active"?"Sospendi":"Riattiva"}</button>}</td></tr>)}
      {filtered.length===0&&<tr><td colSpan={5} style={{...td,color:"#a5a6ad"}}>Nessun utente trovato.</td></tr>}
     </tbody></table></div><p style={{fontSize:10,color:"#8d8f97",lineHeight:1.6}}>La sospensione blocca l'accesso ai dati protetti dalla piattaforma tramite RLS. Non elimina l'account né i movimenti finanziari dell'utente.</p>
    </section>}
    {tab==="catalog"&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(270px,1fr))",gap:13,alignItems:"start"}}>
     <section style={panel}><h2 style={{fontSize:17,margin:"0 0 6px"}}>{editing?"Modifica ETF":"Aggiungi ETF"}</h2><p style={{fontSize:11,color:"#a5a6ad"}}>Catalogo condiviso con tutti gli iscritti</p>
      {[["ISIN","isin"],["Ticker","ticker"],["Nome ETF","name"],["Emittente","issuer"],["Valuta","currency"],["TER (%)","ongoing_charges"]].map(([label,key])=><label key={key} style={{display:"block",fontSize:11,color:"#bfc0c6",marginTop:12}}>{label}<input style={{...field,marginTop:6}} value={String((etf as any)[key]??"")} onChange={e=>setEtf(v=>({...v,[key]:key==="ongoing_charges"?(e.target.value===""?null:Number(e.target.value)):key==="isin"||key==="ticker"?e.target.value.toUpperCase():e.target.value}))} disabled={editing&&key==="isin"} /></label>)}
      <div style={{display:"flex",gap:8,marginTop:16}}><button disabled={busy} style={button(true)} onClick={()=>void saveETF()}>{busy?"Salvataggio…":"Salva ETF"}</button>{editing&&<button style={button()} onClick={()=>{setEditing(false);setEtf({isin:"",ticker:"",name:"",issuer:"",currency:"EUR",ongoing_charges:null});}}>Annulla</button>}</div>
     </section>
     <section style={panel}><h2 style={{fontSize:17,margin:"0 0 12px"}}>ETF presenti · {data.catalog.length}</h2><div style={{maxHeight:620,overflowY:"auto"}}>{catalogItems.map(x=><div key={x.isin} style={{padding:"12px 0",borderBottom:"1px solid #ffffff17",display:"flex",gap:8,alignItems:"center"}}><div style={{flex:1,minWidth:0}}><b style={{fontSize:12}}>{x.ticker||x.isin}</b><div style={{fontSize:10,color:"#a5a6ad",overflowWrap:"anywhere"}}>{x.name} · {x.isin}</div></div><button style={button()} onClick={()=>{setEtf(x);setEditing(true);window.scrollTo({top:0,behavior:"smooth"});}}>Modifica</button><button style={{...button(),color:"#ffaaaa"}} onClick={()=>{if(confirm("Eliminare "+x.ticker+" dal catalogo? Se è già usato da utenti il database impedirà la cancellazione."))void action("admin_delete_etf",{p_isin:x.isin},"ETF eliminato.");}}>Elimina</button></div>)}</div></section>
    </div>}
    {tab==="premium"&&<section style={{...panel,maxWidth:760}}><div style={{color:"#cfff80",fontSize:10,letterSpacing:1.5,fontWeight:700}}>LIVELLO PREMIUM</div><h2 style={{fontSize:20,margin:"9px 0 6px"}}>Preparazione del servizio</h2><p style={{fontSize:12,color:"#a5a6ad",lineHeight:1.7}}>Puoi preparare la presentazione del servizio. Questa impostazione non crea abbonamenti, non incassa pagamenti e non assegna automaticamente vantaggi agli utenti.</p>
     <label style={{display:"flex",gap:10,alignItems:"center",margin:"18px 0",fontSize:13}}><input type="checkbox" checked={premiumEnabled} onChange={e=>setPremiumEnabled(e.target.checked)}/> Mostra Premium come disponibile nella piattaforma</label>
     <label style={{display:"block",fontSize:11,color:"#bfc0c6"}}>Etichetta<input style={{...field,marginTop:6}} maxLength={40} value={premiumLabel} onChange={e=>setPremiumLabel(e.target.value)}/></label>
     <label style={{display:"block",fontSize:11,color:"#bfc0c6",marginTop:13}}>Descrizione<input style={{...field,marginTop:6}} maxLength={240} value={premiumDescription} onChange={e=>setPremiumDescription(e.target.value)}/></label>
     <button disabled={busy} style={{...button(true),marginTop:16}} onClick={()=>void savePremium()}>{busy?"Salvataggio…":"Salva impostazioni Premium"}</button>
     <div style={{marginTop:18,padding:13,borderRadius:11,background:"#ffffff08",fontSize:11,color:"#a5a6ad",lineHeight:1.7}}>Prima di attivare pagamenti serviranno condizioni commerciali, gestione abbonamenti, fatturazione e licenze per la redistribuzione dei dati ETF.</div>
    </section>}
   </>}
   <footer style={{fontSize:10,color:"#777982",marginTop:22}}>Pannello protetto da funzioni SQL SECURITY DEFINER e verifica ruolo amministratore nel database. Nessun accesso diretto dal client alle tabelle dei ruoli.</footer>
  </div>
 </main>;
}

const th:React.CSSProperties={padding:"12px 9px",borderBottom:"1px solid #ffffff25",color:"#a5a6ad",fontSize:10,whiteSpace:"nowrap"};
const td:React.CSSProperties={padding:"12px 9px",borderBottom:"1px solid #ffffff14",verticalAlign:"middle"};
function Kpi({label,value}:{label:string;value:number}){return <section style={panel}><div style={{fontSize:11,color:"#b9bac0",marginBottom:13}}>{label}</div><div style={{fontSize:29,fontWeight:800,color:"#d2ff8a"}}>{fmt(value)}</div></section>}
