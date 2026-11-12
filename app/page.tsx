"use client";
import {useEffect,useMemo,useState} from "react";
import {Activity,ArrowUpRight,Bell,ChartNoAxesCombined,ChevronDown,Eye,EyeOff,FileSpreadsheet,LayoutDashboard,Menu,Plus,Search,Settings,Star,Wallet,X} from "lucide-react";
import {Area,AreaChart,CartesianGrid,ResponsiveContainer,Tooltip,XAxis} from "recharts";
import {getSupabaseBrowserClient} from "../lib/supabase/client";
type Fund={ticker:string;name:string;isin:string;qty:number;avg:number;price:number;change:number};
const initial:Fund[]=[];
const catalog:Fund[]=[];
const money=(n:number)=>n.toLocaleString("it-IT",{style:"currency",currency:"EUR"});
const history:{d:string,v:number}[]=[];
export default function Home(){
const [section,S]=useState("Overview"),[mobile,M]=useState(false),[hidden,H]=useState(false),[query,Q]=useState(""),[selectedFund,SelectFund]=useState<Fund|null>(null),[funds,F]=useState(initial),[tx,T]=useState<{id:number,ticker:string,qty:number,price:number,fee:number,date:string}[]>([]),[modal,D]=useState(false),[ticker,K]=useState(""),[purchaseIsin,PurchaseIsin]=useState(""),[purchaseSearchBusy,PurchaseSearchBusy]=useState(false),[purchaseSearchMessage,PurchaseSearchMessage]=useState(""),[qty,Y]=useState("1"),[price,Z]=useState("127.50"),[fee,E]=useState("6.50"),[toast,B]=useState(""),[authOpen,AuthOpen]=useState(false),[email,Email]=useState(""),[password,Password]=useState(""),[userEmail,UserEmail]=useState<string|null>(null),[authBusy,AuthBusy]=useState(false),[authMode,AuthMode]=useState<"login"|"signup">("login"),[cloudReady,CloudReady]=useState(false),[extraFunds,ExtraFunds]=useState<Fund[]>([]),[newEtfOpen,NewEtfOpen]=useState(false),[newTicker,NewTicker]=useState(""),[newIsin,NewIsin]=useState(""),[newName,NewName]=useState(""),[newIssuer,NewIssuer]=useState(""),[isinSearchBusy,IsinSearchBusy]=useState(false),[isinSearchMessage,IsinSearchMessage]=useState("");
useEffect(()=>{
 const supabase=getSupabaseBrowserClient();
 if(!supabase){CloudReady(true);return;}
 let active=true;
 const loadCloud=async()=>{
  const {data:{user},error:userError}=await supabase.auth.getUser();
  if(!active)return;
  if(userError){B("Impossibile verificare la sessione Supabase: "+userError.message);CloudReady(false);return;}
  if(!user){F([]);T([]);ExtraFunds([]);CloudReady(true);return;}
  const [{data:rows,error:txError},{data:etfRows,error:etfError}]=await Promise.all([
   supabase.from("portfolio_transactions").select("id,isin,transaction_type,quantity,unit_price,fees,currency,executed_at,notes,etfs(ticker,name)").eq("user_id",user.id).order("executed_at",{ascending:true}).order("created_at",{ascending:true}),
   supabase.from("etfs").select("isin,ticker,name,issuer").order("ticker")
  ]);
  if(!active)return;
  if(txError){B("Lettura movimenti Supabase non riuscita: "+txError.message);CloudReady(false);return;}
  if(etfError){B("Lettura catalogo ETF non riuscita: "+etfError.message);CloudReady(false);return;}
  ExtraFunds((etfRows||[]).map((x:any)=>({ticker:x.ticker||x.isin,name:x.name||x.isin,isin:x.isin,qty:0,avg:0,price:0,change:0})));
  const grouped=new Map<string,Fund>();
  const cloudTx=(rows||[]).map((row:any)=>{
   const relation=Array.isArray(row.etfs)?row.etfs[0]:row.etfs;
   const ticker=String(relation?.ticker||row.isin);
   const name=String(relation?.name||ticker);
   const q=Number(row.quantity)||0;
   const p=Number(row.unit_price)||0;
   const fees=Number(row.fees)||0;
   const type=String(row.transaction_type);
   const current=grouped.get(ticker)||{ticker,name,isin:row.isin,qty:0,avg:0,price:p,change:0};
   if(type==="buy"&&q>0){
    const nextQty=current.qty+q;
    current.avg=(current.avg*current.qty+q*p+fees)/nextQty;
    current.qty=nextQty;
    current.price=p;
   }else if(type==="sell"&&q>0){
    current.qty=Math.max(0,current.qty-q);
    if(current.qty===0)current.avg=0;
    current.price=p;
   }
   grouped.set(ticker,current);
   return {id:row.id,ticker,qty:q,price:p,fee:fees,date:new Date(row.executed_at).toLocaleDateString("it-IT"),type};
  });
  if(!active)return;
  F([...grouped.values()].filter(x=>x.qty>0));
  T(cloudTx as any);
  CloudReady(true);
 };
 supabase.auth.getSession().then(async(result:any)=>{
  if(!active)return;
  const session=result.data.session;
  UserEmail(session?.user.email??null);
  if(session)await loadCloud();
  else{F([]);T([]);ExtraFunds([]);CloudReady(true);}
 });
 const {data:{subscription}}=supabase.auth.onAuthStateChange((_event:any,session:any)=>{
  UserEmail(session?.user.email??null);
  if(!session){F([]);T([]);ExtraFunds([]);CloudReady(true);return;}
  CloudReady(false);
  void loadCloud();
 });
 return()=>{active=false;subscription.unsubscribe();};
},[]);
const allCatalog=[...catalog,...extraFunds.filter(x=>!catalog.some(y=>y.isin===x.isin))];const total=funds.reduce((s,p)=>s+p.qty*p.price,0),invested=funds.reduce((s,p)=>s+p.qty*p.avg,0),profit=total-invested,fmt=(n:number)=>hidden?"••••••":money(n);
const nav=[["Overview",LayoutDashboard],["Portafoglio",Wallet],["Esplora ETF",Search],["Watchlist",Star],["PAC",Activity],["Analisi",ChartNoAxesCombined],["Transazioni",FileSpreadsheet]] as const;
async function searchPurchaseIsin(){const isin=purchaseIsin.trim().toUpperCase();if(!/^[A-Z]{2}[A-Z0-9]{10}$/.test(isin)){PurchaseSearchMessage("Inserisci un ISIN valido di 12 caratteri.");return;}const sb=getSupabaseBrowserClient();if(!sb||!userEmail){B("Accedi per cercare l'ETF nel catalogo.");return;}PurchaseSearchBusy(true);PurchaseSearchMessage("");const {data,error}=await sb.from("etfs").select("isin,ticker,name").eq("isin",isin).maybeSingle();PurchaseSearchBusy(false);if(error){PurchaseSearchMessage("Errore di ricerca: "+error.message);return;}if(!data){PurchaseSearchMessage("ETF non trovato nel catalogo. Aggiungilo prima dalla sezione ETF.");K("");return;}K(data.ticker);PurchaseSearchMessage((data.name||data.ticker)+" · "+data.ticker+" selezionato.");}
async function save(){
 const n=Number(qty),v=Number(price),c=Number(fee);
 if(!Number.isFinite(n)||!Number.isFinite(v)||!Number.isFinite(c)||n<=0||v<=0||c<0){B("Controlla quantità, prezzo e commissione.");return;}
 const sb=getSupabaseBrowserClient();
 if(!sb||!userEmail){B("Accedi a Supabase prima di salvare un acquisto.");return;}
 const {data:{user},error:userError}=await sb.auth.getUser();
 if(userError||!user){B("Sessione Supabase non valida. Accedi di nuovo.");return;}
 const {data:etf,error:etfError}=await sb.from("etfs").select("isin,ticker,name").eq("isin",purchaseIsin.trim().toUpperCase()).maybeSingle();
 if(etfError){B("Errore nella ricerca ETF su Supabase: "+etfError.message);return;}
 if(!etf){B("ETF non trovato nel catalogo cloud. Aggiungilo prima dalla sezione ETF.");return;}
 const {error}=await sb.from("portfolio_transactions").insert({user_id:user.id,isin:etf.isin,transaction_type:"buy",quantity:n,unit_price:v,fees:c,currency:"EUR"});
 if(error){B("Salvataggio cloud non riuscito: "+error.message);return;}
 const old=funds.find(x=>x.ticker===etf.ticker);
 const base=old||{ticker:etf.ticker,name:etf.name||etf.ticker,isin:etf.isin,qty:0,avg:0,price:v,change:0};
 const nextQty=base.qty+n;
 const next={...base,qty:nextQty,avg:(base.qty*base.avg+n*v+c)/nextQty,price:v};
 F([...funds.filter(x=>x.ticker!==etf.ticker),next]);
 const item={id:Date.now(),ticker:etf.ticker,qty:n,price:v,fee:c,date:new Date().toLocaleDateString("it-IT")};
 T([item,...tx]);
 D(false);
 PurchaseIsin("");K("");PurchaseSearchMessage("");
 B("Acquisto salvato correttamente su Supabase.");
 setTimeout(()=>B(""),4000);
}
async function searchEtfByIsin(){const isin=newIsin.trim().toUpperCase();if(!/^[A-Z]{2}[A-Z0-9]{10}$/.test(isin)){IsinSearchMessage("Inserisci un ISIN valido di 12 caratteri.");return;}const sb=getSupabaseBrowserClient();if(!sb||!userEmail){B("Accedi per cercare nel catalogo ETF.");return;}IsinSearchBusy(true);IsinSearchMessage("");const {data,error}=await sb.from("etfs").select("isin,ticker,name,issuer").eq("isin",isin).maybeSingle();IsinSearchBusy(false);if(error){IsinSearchMessage("Ricerca non riuscita: "+error.message);return;}if(!data){IsinSearchMessage("ISIN non presente nel catalogo. Puoi completare i dati manualmente e proporre l'inserimento.");return;}NewTicker(data.ticker||"");NewName(data.name||"");NewIssuer(data.issuer||"");IsinSearchMessage("ETF trovato nel catalogo: dati identificativi compilati.");}
async function addEtf(){const isin=newIsin.trim().toUpperCase(),ticker=newTicker.trim().toUpperCase(),name=newName.trim();if(!isin||!ticker||!name)return;const sb=getSupabaseBrowserClient();if(!sb||!userEmail){B("Accedi per aggiungere ETF al catalogo.");return;}const {data:{user}}=await sb.auth.getUser();const {error}=await sb.from("etfs").insert({isin,ticker,name,issuer:newIssuer.trim()||null});if(error){B(error.code==="23505"?"Questo ISIN è già presente nel catalogo.":"Impossibile aggiungere l’ETF: "+error.message);return;}ExtraFunds(old=>[...old,{ticker,name,isin,qty:0,avg:0,price:0,change:0}]);K(ticker);NewEtfOpen(false);NewTicker("");NewIsin("");NewName("");NewIssuer("");IsinSearchMessage("");B("ETF aggiunto. Ora puoi registrare il tuo acquisto.");setTimeout(()=>B(""),4000)}
const results=allCatalog.filter(x=>(x.ticker+x.name+x.isin).toLowerCase().includes(query.toLowerCase()));
return <main className="shell"><aside className={"sidebar "+(mobile?"open":"")}><div className="brand"><div className="mark">✳</div><div className="brandcopy"><b>IL MIO PERCORSO ETF</b><small>INVESTIMENTI INTELLIGENTI</small></div><button className="close" onClick={()=>M(false)}><X/></button></div><div className="side-label">WORKSPACE</div><nav>{nav.map(([label,Icon])=><button key={label} className={"nav "+(section===label?"active":"")} onClick={()=>{S(label);M(false)}}><Icon size={19}/><span>{label}</span></button>)}</nav><div className="push"/><button className="nav"><Settings size={19}/><span>Impostazioni</span></button><div className="user"><div className="avatar">{userEmail?userEmail[0].toUpperCase():"M"}</div><div><b>{userEmail||"Modalità demo"}</b><small>{userEmail?"Account Supabase":"Account locale"}</small></div></div></aside>
<section className="main"><header className="top"><button className="icon mobilemenu" onClick={()=>M(true)}><Menu/></button><div className="tabs">{["Overview","Portafoglio","ETF","Analisi","Simulatori"].map(x=><button key={x} className={(x===section||(x==="ETF"&&section==="Esplora ETF")||(x==="Simulatori"&&section==="PAC"))?"sel":""} onClick={()=>S(x==="ETF"?"Esplora ETF":x==="Simulatori"?"PAC":x)}>{x}</button>)}</div><div className="actions"><span className="market"><i/> DEMO MODE</span><button className="icon" onClick={()=>H(!hidden)}>{hidden?<EyeOff/>:<Eye/>}</button><button className="icon"><Bell/></button><button className="auth-trigger" onClick={()=>AuthOpen(true)}>{userEmail?"Account":"Accedi"}</button><div className="avatar small">{userEmail?userEmail[0].toUpperCase():"M"}</div></div></header>
<div className="content"><div className="heading"><div><div className="eyebrow">{new Date().toLocaleDateString("it-IT",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).toUpperCase()}</div><h1>{section==="Overview"?"Bentornato nel tuo percorso.":section}</h1><p>Una visione chiara dei tuoi investimenti, un passo alla volta.</p></div><button className="primary" onClick={()=>D(true)}><Plus size={16}/> Registra acquisto</button></div>
{section === "Overview" && (
  <>
    <div className="kpis">
      <Kpi label="Patrimonio totale" value={total} format={fmt} note="Valore del portafoglio" />
      <Kpi label="Capitale investito" value={invested} format={fmt} note="Costo medio delle posizioni" />
      <Kpi label="Profitto / perdita" value={profit} format={(n) => (n >= 0 ? "+ " : "") + fmt(n)} note={((profit / (invested || 1)) * 100).toFixed(2) + "%"} />
      <Kpi label="PAC mensile" value={0} format={fmt} note="Nessun PAC configurato" />
    </div>
    <div className="grid">
      <section className="panel chart">
        <div className="panelhead">
          <div><h2>Andamento del portafoglio</h2><p>Valore nel tempo · serie dimostrativa</p></div>
          <span className="tag">ULTIMO MESE</span>
        </div>
        <div className="chartvalue"><AnimatedNumber value={total} format={fmt} /></div>
        <div className="graph">
          {funds.length === 0 ? (
            <div className="empty-state">Aggiungi il tuo primo ETF per iniziare a visualizzare il portafoglio.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history}>
                <defs><linearGradient id="lime" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#baf35e" stopOpacity={0.32} /><stop offset="100%" stopColor="#baf35e" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid stroke="#ffffff12" vertical={false} />
                <XAxis dataKey="d" stroke="#85868e" tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{background:"#28292e",border:"1px solid #ffffff25",borderRadius:10,color:"#fff"}} formatter={(v) => money(Number(v))} />
                <Area type="monotone" dataKey="v" stroke="#baf35e" strokeWidth={2.5} fill="url(#lime)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
        <small className="muted">Lo storico verrà mostrato quando saranno disponibili rilevazioni reali.</small>
      </section>
      <section className="panel allocation">
        <div className="panelhead"><div><h2>Composizione</h2><p>Distribuzione indicativa</p></div></div>
        {funds.length === 0 ? <div className="empty-state">La composizione apparirà dopo aver inserito le tue posizioni.</div> : <div className="donut"><div><b>{funds.length}</b><small>ETF</small></div></div>}
      </section>
    </div>
    <div className="grid lower">
      <section className="panel section">
        <div className="panelhead"><div><h2>Le tue posizioni</h2><p>Riepilogo strumenti in portafoglio</p></div><button className="textbtn" onClick={() => S("Portafoglio")}>Vedi tutto ↗</button></div>
        <FundTable rows={funds.slice(0, 4)} hidden={hidden} />
      </section>
      <section className="panel section">
        <h2>Azioni rapide</h2>
        <div className="quick">
          <button onClick={() => D(true)}><Plus />Aggiungi acquisto</button>
          <button onClick={() => S("Esplora ETF")}><Search />Cerca ETF</button>
          <button onClick={() => S("PAC")}><Activity />Piano PAC</button>
          <button onClick={() => S("Transazioni")}><FileSpreadsheet />Movimenti</button>
        </div>
        <div className="insight"><b>Il tuo percorso, un passo alla volta.</b><p>La costanza nel tempo conta più delle oscillazioni di breve periodo.</p></div>
      </section>
    </div>
  </>
)}
{section==="Portafoglio"&&<section className="panel section"><div className="panelhead"><h2>Portafoglio ETF</h2><button className="primary" onClick={()=>D(true)}><Plus/> Nuovo acquisto</button></div><FundTable rows={funds} hidden={hidden}/><div className="totalrow">Valore complessivo <b>{fmt(total)}</b></div></section>}
{section==="Esplora ETF"&&<section className="panel section"><div className="panelhead"><div><h2>Esplora ETF</h2><p>Cerca uno strumento o aggiungilo tramite ISIN.</p></div><button className="primary" onClick={()=>NewEtfOpen(true)}><Plus/> Aggiungi ETF</button></div><div className="search"><Search/><input placeholder="Cerca ticker, nome o ISIN..." value={query} onChange={e=>{Q(e.target.value);SelectFund(null)}}/></div><>{results.map(p=><div className="explorerow" key={p.ticker} role="button" tabIndex={0} aria-label={"Apri dettagli " + p.ticker} onClick={()=>SelectFund(p)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();SelectFund(p)}}}><div className="ticker">{p.ticker[0]}</div><div className="fund"><b>{p.ticker}</b><small>{p.name}</small><small>{p.isin}</small></div><strong>{money(p.price)}</strong><button className="icon" aria-label={"Registra acquisto " + p.ticker} onClick={e=>{e.stopPropagation();K(p.ticker);Z(String(p.price));D(true)}}><Plus/></button></div>)}{selectedFund&&<section className="fund-detail"><div className="panelhead"><div><span className="tag">SCHEDA ETF · DATI DEMO</span><h2>{selectedFund.name}</h2><p>{selectedFund.ticker} · ISIN {selectedFund.isin}</p></div><button className="icon" aria-label="Chiudi dettagli ETF" onClick={()=>SelectFund(null)}><X/></button></div><div className="fund-detail-grid"><div><small>Prezzo indicativo</small><b>{money(selectedFund.price)}</b></div><div><small>Variazione dimostrativa</small><b className={selectedFund.change>=0?"positive":"negative"}>{selectedFund.change>=0?"+":""}{selectedFund.change.toLocaleString("it-IT")}%</b></div></div><p className="muted">Queste informazioni appartengono al catalogo dimostrativo della V30 e non sono quotazioni in tempo reale né una scheda ufficiale dell'emittente.</p><button className="primary" onClick={()=>{K(selectedFund.ticker);Z(String(selectedFund.price));D(true)}}><Plus size={16}/> Registra acquisto</button></section>}</></section>}
{section==="Watchlist"&&<section className="panel section"><h2>Watchlist</h2><p>Strumenti da tenere sotto osservazione</p>{catalog.slice(0,4).map(p=><div className="explorerow" key={p.ticker}><Star color="#c6f879"/><div className="fund"><b>{p.ticker}</b><small>{p.name}</small></div><strong>{money(p.price)}</strong></div>)}</section>}
{section==="PAC"&&<div className="grid"><section className="panel section"><div className="eyebrow">PIANO DI ACCUMULO · DEMO</div><h2>La forza della costanza.</h2><p>Versamenti mensili ipotetici, senza invio di ordini al broker.</p><div className="bigamount">€ 250 <small>/ mese</small></div><div className="metric"><span>Versamento annuale</span><b>€ 3.000</b></div><div className="metric"><span>Orizzonte</span><b>20 anni</b></div><div className="metric"><span>Capitale versato</span><b>€ 60.000</b></div></section><section className="panel section"><h2>Simulatore PAC</h2><p>Ipotesi illustrativa di rendimento annuo del 7%, non garantito.</p><label>Versamento mensile (€)<input type="number" defaultValue="250"/></label><label>Durata (anni)<input type="number" defaultValue="20"/></label><div className="bigamount">€ 130.200</div><span className="tag">STIMA NON GARANTITA</span></section></div>}
{section==="Analisi"&&<div className="grid"><section className="panel section"><h2>Salute del portafoglio</h2><div className="score">78 <small>/100</small></div><p>Indicatore dimostrativo di diversificazione. Valuta concentrazione geografica e sovrapposizione degli indici.</p></section><section className="panel section"><h2>Indicatori</h2>{[["Numero strumenti",String(funds.length)],["Esposizione azionaria","92%"],["Valuta prevalente","EUR"],["Rendimento complessivo",((profit/invested)*100||0).toFixed(2)+"%"]].map(x=><div className="metric" key={x[0]}><span>{x[0]}</span><b>{x[1]}</b></div>)}</section></div>}
{section==="Transazioni"&&<section className="panel section"><div className="panelhead"><div><h2>Registro movimenti</h2><p>Operazioni demo salvate in questo browser</p></div><button className="primary" onClick={()=>D(true)}><Plus/> Nuovo movimento</button></div>{tx.length===0?<p>Nessun movimento registrato.</p>:tx.map(t=><div className="explorerow" key={t.id}><ArrowUpRight/><div className="fund"><b>Acquisto · {t.ticker}</b><small>{t.date} · {t.qty} quote · commissione {money(t.fee)}</small></div><strong>{money(t.qty*t.price+t.fee)}</strong></div>)}</section>}
<footer>IL MIO PERCORSO ETF <i/> GLASS DASHBOARD V30 <span>· Modalità demo · Nessun ordine reale</span></footer></div></section>
{authOpen&&<div className="backdrop" onClick={()=>AuthOpen(false)}><section className="modal panel" onClick={e=>e.stopPropagation()}><div className="panelhead"><div><div className="eyebrow">ACCOUNT · SUPABASE</div><h2>{userEmail?"Account collegato":"Accedi alla community"}</h2></div><button className="icon" onClick={()=>AuthOpen(false)}><X/></button></div>{userEmail?<><p className="muted">Accesso effettuato con {userEmail}. I dati cloud personali sono protetti da Row Level Security.</p><button className="secondary" onClick={async()=>{const sb=getSupabaseBrowserClient();if(sb)await sb.auth.signOut();AuthOpen(false);B("Disconnessione completata");}}>Esci dall’account</button></>:<><p className="muted">Accedi o crea un account per preparare la sincronizzazione del portafoglio. Le credenziali vengono gestite da Supabase.</p><div className="auth-switch"><button className={authMode==="login"?"selected":""} onClick={()=>AuthMode("login")}>Accedi</button><button className={authMode==="signup"?"selected":""} onClick={()=>AuthMode("signup")}>Crea account</button></div><label>Email<input type="email" autoComplete="email" value={email} onChange={e=>Email(e.target.value)} placeholder="nome@email.com"/></label><label>Password<input type="password" autoComplete={authMode==="login"?"current-password":"new-password"} value={password} onChange={e=>Password(e.target.value)} placeholder="Almeno 8 caratteri"/></label><button className="primary auth-submit" disabled={authBusy||!email||password.length<8} onClick={async()=>{const sb=getSupabaseBrowserClient();if(!sb){B("Configura prima URL e chiave pubblica Supabase in Vercel");return;}AuthBusy(true);const result=authMode==="login"?await sb.auth.signInWithPassword({email,password}):await sb.auth.signUp({email,password});AuthBusy(false);if(result.error){B(result.error.message);}else if(authMode==="signup"&&!result.data.session){B("Account creato: controlla la tua email per confermare l’indirizzo.");}else{B("Accesso effettuato");AuthOpen(false);}setTimeout(()=>B(""),4500);}}>{authBusy?"Attendere…":authMode==="login"?"Accedi":"Crea account"}</button></>}</section></div>}{newEtfOpen&&<div className="backdrop" onClick={()=>NewEtfOpen(false)}><section className="modal panel" onClick={e=>e.stopPropagation()}><div className="panelhead"><div><div className="eyebrow">CATALOGO PERSONALE</div><h2>Aggiungi un ETF</h2></div><button className="icon" onClick={()=>NewEtfOpen(false)}><X/></button></div><p className="muted">Cerca prima l’ISIN nel catalogo condiviso. Se è presente, ticker, nome ed emittente vengono compilati automaticamente.</p><label>ISIN<input value={newIsin} maxLength={12} onChange={e=>{NewIsin(e.target.value.toUpperCase().replace(/\\s/g,""));IsinSearchMessage("");}} placeholder="Es. IE00BFMXXD54"/></label><button className="secondary" disabled={isinSearchBusy||!newIsin.trim()} onClick={searchEtfByIsin}>{isinSearchBusy?"Ricerca in corso…":"Cerca tramite ISIN"}</button>{isinSearchMessage&&<p className="muted">{isinSearchMessage}</p>}<label>Ticker<input value={newTicker} onChange={e=>NewTicker(e.target.value.toUpperCase())} placeholder="Compilato dalla ricerca o inserito manualmente"/></label><label>Nome ETF<input value={newName} onChange={e=>NewName(e.target.value)} placeholder="Nome completo dello strumento"/></label><label>Emittente (facoltativo)<input value={newIssuer} onChange={e=>NewIssuer(e.target.value)} placeholder="Es. Vanguard"/></label><div className="modalactions"><button className="secondary" onClick={()=>NewEtfOpen(false)}>Annulla</button><button className="primary" disabled={!newIsin.trim()||!newTicker.trim()||!newName.trim()} onClick={addEtf}>Salva ETF</button></div></section></div>}{modal&&<div className="backdrop" onClick={()=>D(false)}><section className="modal panel" onClick={e=>e.stopPropagation()}><div className="panelhead"><div><div className="eyebrow">PORTAFOGLIO · DEMO</div><h2>Registra un acquisto</h2></div><button className="icon" onClick={()=>D(false)}><X/></button></div><p className="muted">L'operazione viene salvata nel browser e, se hai collegato Supabase, anche nel tuo account. Nessun ordine viene inviato al broker.</p><label>ISIN dell’ETF<input value={purchaseIsin} maxLength={12} onChange={e=>{PurchaseIsin(e.target.value.toUpperCase().replace(/\\s/g,""));K("");PurchaseSearchMessage("");}} placeholder="Es. IE00BFMXXD54"/></label><button className="secondary" disabled={purchaseSearchBusy||!purchaseIsin.trim()} onClick={searchPurchaseIsin}>{purchaseSearchBusy?"Ricerca in corso…":"Cerca ETF tramite ISIN"}</button>{purchaseSearchMessage&&<p className="muted">{purchaseSearchMessage}</p>}{ticker&&<p className="muted">ETF selezionato: <b>{ticker}</b></p>}<div className="formgrid"><label>Quantità<input type="number" min="0" step="any" value={qty} onChange={e=>Y(e.target.value)}/></label><label>Prezzo quota (€)<input type="number" min="0" step="any" value={price} onChange={e=>Z(e.target.value)}/></label></div><label>Commissione (€)<input type="number" min="0" step="any" value={fee} onChange={e=>E(e.target.value)}/></label><div className="totalrow">Totale con commissione <b>{money((+qty||0)*(+price||0)+(+fee||0))}</b></div><div className="modalactions"><button className="secondary" onClick={()=>D(false)}>Annulla</button><button className="primary" disabled={!ticker||!purchaseIsin.trim()} onClick={save}>Salva operazione</button></div></section></div>}{toast&&<div className="toast">✓ {toast}</div>}</main>}
function AnimatedNumber({value,format}:{value:number,format:(n:number)=>string}){const [shown,Shown]=useState(0);useEffect(()=>{let frame=0;const start=performance.now(),duration=1100;const tick=(now:number)=>{const t=Math.min(1,(now-start)/duration);Shown(value*(1-Math.pow(1-t,3)));if(t<1)frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);},[value]);return <>{format(shown)}</>}
function Kpi({label,value,note,format}:{label:string,value:number,note:string,format:(n:number)=>string}){const [shown,Shown]=useState(0);useEffect(()=>{let frame=0;const start=performance.now(),duration=1100;const tick=(now:number)=>{const t=Math.min(1,(now-start)/duration);Shown(value*(1-Math.pow(1-t,3)));if(t<1)frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);},[value]);return <section className="panel kpi"><div className="kpitop"><span>{label}</span><i><ChartNoAxesCombined size={17}/></i></div><b>{format(shown)}</b><small>{note}</small></section>}
function FundTable({rows,hidden}:{rows:Fund[],hidden:boolean}){return <div className="tablewrap"><table><thead><tr><th>STRUMENTO</th><th>QUOTE</th><th>PREZZO</th><th>VALORE</th><th>VARIAZIONE</th></tr></thead><tbody>{rows.length===0?<tr><td colSpan={5} className="empty-cell">Nessun ETF nel portafoglio. Registra il tuo primo acquisto.</td></tr>:rows.map(p=>{const pnl=(p.price-p.avg)*p.qty;return <tr key={p.ticker}><td><b>{p.ticker}</b><small className="subfund">{p.name}</small></td><td>{p.qty}</td><td>{money(p.price)}</td><td><b>{hidden?"••••••":money(p.qty*p.price)}</b></td><td className={pnl>=0?"positive":"negative"}>{pnl>=0?"+":""}{hidden?"••":money(pnl)}</td></tr>})}</tbody></table></div>}
