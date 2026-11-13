"use client";
import {useEffect,useMemo,useState} from "react";
import {Info,ArrowRight,SlidersHorizontal,RefreshCw} from "lucide-react";

type Fund={ticker:string;name:string;isin:string;qty:number;avg:number;price:number;change:number};
type Point={date:string;value:number};
type Props={funds:Fund[];history:Point[];historyStatus:"idle"|"loading"|"ready"|"error"};
const eur=(n:number)=>n.toLocaleString("it-IT",{style:"currency",currency:"EUR"});
const pct=(n:number)=>n.toLocaleString("it-IT",{minimumFractionDigits:2,maximumFractionDigits:2})+"%";
const WORLD=[
"M75 80 L105 48 153 30 204 37 231 56 258 61 278 88 265 111 246 118 235 142 214 148 207 173 187 184 169 164 153 158 135 140 116 132 104 111 84 105Z",
"M220 184 L244 194 258 220 254 246 267 267 260 302 246 333 231 354 219 333 214 302 201 277 204 244 190 222Z",
"M278 45 L302 25 326 32 334 51 319 66 297 62Z",
"M363 91 L386 79 413 84 430 72 466 76 490 62 530 68 556 54 600 62 625 83 666 82 699 100 722 120 709 139 680 137 664 154 637 148 619 165 597 158 583 174 559 167 545 181 518 177 499 160 475 164 459 149 438 157 421 144 398 151 382 135 360 130Z",
"M421 164 L450 174 472 196 468 224 451 250 443 279 424 302 404 291 392 263 377 243 382 213 395 189Z",
"M586 235 L614 222 646 229 663 251 651 272 620 280 592 267Z",
"M350 322 L430 322 508 330 592 329 668 324 739 330 792 345 758 356 688 359 615 354 544 360 466 353 396 356Z",
"M739 157 L748 149 758 153 755 165Z","M780 188 L790 181 800 187 794 198Z"
];
export default function FirePortfolio({funds,history,historyStatus}:Props){
 const [tab,setTab]=useState<"Prodotti"|"Paesi"|"Riassunto AI">("Paesi");
 const [details,setDetails]=useState(false);
 const [rebalance,setRebalance]=useState("Annuale");
 const [taxes,setTaxes]=useState(false),[stamp,setStamp]=useState(false),[inflation,setInflation]=useState(false);
 const [market,setMarket]=useState<Point[]>([]);
 const [marketState,setMarketState]=useState<"loading"|"ready"|"error">("loading");
 const [marketError,setMarketError]=useState("");
 useEffect(()=>{
  let cancelled=false;
  const load=async()=>{
   if(!funds.length){setMarket([]);setMarketState("error");setMarketError("Aggiungi almeno un ETF.");return;}
   setMarketState("loading");setMarketError("");
   try{
    const response=await fetch("/api/portfolio-history",{method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",body:JSON.stringify({positions:funds.map(f=>({isin:f.isin,quantity:f.qty}))})});
    const payload=await response.json();
    if(!response.ok||!Array.isArray(payload.points))throw new Error(payload.error||"Storico di mercato non disponibile.");
    const all=payload.points as Point[];
    const last=all.length?new Date(all[all.length-1].date+"T12:00:00").getTime():Date.now();
    const year=all.filter(p=>new Date(p.date+"T12:00:00").getTime()>=last-365*86400000);
    if(year.length<2)throw new Error("Il provider non ha ancora restituito almeno due rilevazioni nell'ultimo anno.");
    if(!cancelled){setMarket(year);setMarketState("ready");}
   }catch(e){if(!cancelled){setMarket([]);setMarketState("error");setMarketError(e instanceof Error?e.message:"Errore nel caricamento dello storico.");}}
  };
  void load();return()=>{cancelled=true;};
 },[funds.map(f=>f.isin+":"+f.qty).join("|")]);
 const metrics=useMemo(()=>{
  if(market.length<2)return null;
  const values=market.map(p=>p.value).filter(v=>Number.isFinite(v)&&v>0);
  if(values.length<2)return null;
  const returns=values.slice(1).map((v,i)=>v/values[i]-1).filter(Number.isFinite);
  const mean=returns.reduce((s,v)=>s+v,0)/returns.length;
  const variance=returns.reduce((s,v)=>s+(v-mean)**2,0)/Math.max(1,returns.length-1);
  let peak=values[0],drawdown=0;
  values.forEach(v=>{peak=Math.max(peak,v);drawdown=Math.min(drawdown,v/peak-1);});
  const totalReturn=(values[values.length-1]/values[0]-1)*100;
  const volatility=returns.length>=20?Math.sqrt(variance)*Math.sqrt(252)*100:null;
  const sharpe=volatility!==null&&volatility>0?(mean*252)/(volatility/100/Math.sqrt(252)):null;
  return {totalReturn,volatility,sharpe,drawdown:drawdown*100,start:market[0].date,end:market[market.length-1].date,observations:returns.length};
 },[market]);
 const invested=funds.reduce((s,f)=>s+f.qty*f.avg,0);
 return <div className="fire-page">
  <section className="fire-panel">
   <div className="fire-topline"><div><span className="fire-number">1</span><div><b>Portafoglio FIRE</b><small>{funds.length} prodotti in portafoglio</small></div></div><div className="fire-tabs">{(["Prodotti","Paesi","Riassunto AI"] as const).map(x=><button key={x} className={tab===x?"active":""} onClick={()=>setTab(x)}>{x}</button>)}</div></div>
   <div className="fire-exposure">
    <div className="fire-world"><svg viewBox="0 0 840 390" role="img" aria-label="Mappa geografica del mondo"><defs><linearGradient id="land" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8fd4f7"/><stop offset="1" stopColor="#397da9"/></linearGradient><pattern id="grid" width="42" height="42" patternUnits="userSpaceOnUse"><path d="M42 0H0V42" fill="none" stroke="#78a8c8" strokeOpacity=".12"/></pattern></defs><rect width="840" height="390" fill="url(#grid)"/>{WORLD.map((d,i)=><path key={i} d={d} fill="url(#land)" stroke="#a8ddf5" strokeWidth="1.2" strokeLinejoin="round"/>)}<path d="M0 195H840M420 0V390" stroke="#9bc6e2" strokeOpacity=".2" strokeDasharray="4 8" fill="none"/></svg><span>WORLD MAP · NATURAL EARTH STYLE</span></div>
    <div className="fire-country-list">
     {tab==="Paesi"?<div className="fire-empty"><Info size={19}/><b>Ripartizione geografica da collegare ai dati holdings</b><p>La mappa ora mostra i continenti reali in forma vettoriale. Le percentuali per Paese compariranno quando sarà collegata una fonte verificata delle partecipazioni sottostanti degli ETF.</p><small>{funds.length} ETF · esposizione geografica non ancora calcolata</small></div>:tab==="Prodotti"?funds.length?funds.map(f=><div className="fire-product" key={f.isin}><div><b>{f.ticker}</b><small>{f.name} · {f.isin}</small></div><strong>{f.qty.toLocaleString("it-IT",{maximumFractionDigits:4})} quote</strong></div>):<div className="fire-empty">Aggiungi un ETF al portafoglio per visualizzare i prodotti.</div>:<div className="fire-empty"><Info size={19}/><b>Riepilogo automatico in preparazione</b><p>Il riepilogo sarà disponibile quando avremo esposizioni e dati storici verificati.</p></div>}
    </div>
   </div>
   <div className="fire-detail-action"><button onClick={()=>setDetails(v=>!v)}>Composizione dettagliata <ArrowRight size={15}/></button></div>
   {details&&<div className="fire-detail-note"><b>Configurazione analisi</b><div className="fire-options"><label>Ribilanciamento<select value={rebalance} onChange={e=>setRebalance(e.target.value)}><option>Annuale</option><option>Semestrale</option><option>Trimestrale</option><option>Mensile</option><option>Non previsto</option></select></label><label><input type="checkbox" checked={taxes} onChange={e=>setTaxes(e.target.checked)}/> Considera imposte</label><label><input type="checkbox" checked={stamp} onChange={e=>setStamp(e.target.checked)}/> Considera imposta di bollo</label><label><input type="checkbox" checked={inflation} onChange={e=>setInflation(e.target.checked)}/> Considera inflazione</label></div><p>Le opzioni sono impostazioni del modello: non modificano gli ordini né applicano costi finché non inserisci aliquote e parametri fiscali specifici.</p></div>}
  </section>
  <section className="fire-metrics">
   <article><small>RITORNO CUMULATO · 1 ANNO</small><b className={metrics&&metrics.totalReturn>=0?"good":"bad"}>{metrics?pct(metrics.totalReturn):"—"}</b><span>{metrics?"Prezzi di mercato · quantità attuali":marketState==="loading"?"Caricamento…":"Storico non disponibile"}</span></article>
   <article><small>VOLATILITÀ ANNUALIZZATA</small><b>{metrics?.volatility!==null&&metrics?.volatility!==undefined?pct(metrics.volatility):"—"}</b><span>{metrics&&metrics.observations>=20?"Rendimenti giornalieri": "Servono almeno 20 rendimenti"}</span></article>
   <article><small>SHARPE RATIO</small><b>{metrics?.sharpe!==null&&metrics?.sharpe!==undefined?metrics.sharpe.toLocaleString("it-IT",{minimumFractionDigits:2,maximumFractionDigits:2}):"—"}</b><span>Risk-free 0% · solo con dati sufficienti</span></article>
   <article><small>DRAWDOWN MASSIMO</small><b className="bad">{metrics?pct(metrics.drawdown):"—"}</b><span>Dal picco al minimo · 1 anno</span></article>
  </section>
  <section className="fire-analysis panel">
   <div className="fire-analysis-head"><div><small>INTERVALLO ANALISI</small><b>{metrics?new Date(metrics.start+"T12:00:00").toLocaleDateString("it-IT",{month:"short",year:"numeric"})+" – "+new Date(metrics.end+"T12:00:00").toLocaleDateString("it-IT",{month:"short",year:"numeric"}):"In attesa di dati"}</b></div><div><small>VALUTA</small><b>EUR</b></div><div><small>RIBILANCIAMENTO</small><b>{rebalance}</b></div><div><small>INVESTIMENTO REGISTRATO</small><b>{eur(invested)}</b></div><button className="fire-settings" onClick={()=>setDetails(v=>!v)} aria-label="Configura analisi"><SlidersHorizontal size={16}/></button></div>
   <p>{marketState==="loading"?"Caricamento dello storico di mercato dell'ultimo anno…":marketState==="error"?marketError:metrics?"Indicatori calcolati sui prezzi storici in EUR, applicando le quantità attuali a tutto il periodo. Non rappresentano il rendimento contabile effettivo dei versamenti passati.":"Storico insufficiente per calcolare gli indicatori."}</p>
   <small className="fire-disclaimer">Fonte prezzi: storico ETF Compare; conversione valutaria storica BCE tramite Frankfurter quando necessaria. Volatilità e Sharpe richiedono almeno 20 rendimenti. Rendimento e drawdown sono riferiti alla composizione attuale retrodatata. Non sono un rendiconto fiscale o un backtest dei flussi reali.</small>
  </section>
 </div>;
}
