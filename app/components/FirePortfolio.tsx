"use client";
import {useEffect,useMemo,useState} from "react";
import {Info,ArrowRight,SlidersHorizontal} from "lucide-react";

type Fund={ticker:string;name:string;isin:string;qty:number;avg:number;price:number;change:number};
type Point={date:string;value:number};
type Props={funds:Fund[];history:Point[];historyStatus:"idle"|"loading"|"ready"|"error"};
const eur=(n:number)=>n.toLocaleString("it-IT",{style:"currency",currency:"EUR"});
const pct=(n:number)=>n.toLocaleString("it-IT",{minimumFractionDigits:2,maximumFractionDigits:2})+"%";
const WORLD=[
"M40 75 L49 57 65 47 78 31 98 27 108 35 104 47 115 55 110 66 95 67 88 82 76 91 62 89 53 101 42 96Z",
"M58 105 L73 99 88 105 96 119 111 123 119 137 132 143 138 157 151 164 154 178 145 188 132 185 124 174 111 169 104 155 91 149 84 135 72 129 68 116Z",
"M119 185 L133 187 143 198 151 213 148 230 139 244 130 239 124 223 116 211Z",
"M151 67 L160 57 171 58 178 68 172 79 160 80Z",
"M168 86 L180 76 197 78 207 69 223 74 235 68 251 78 267 75 282 84 299 81 314 91 328 88 343 100 356 101 368 116 357 127 343 123 332 132 318 128 306 139 293 133 280 141 264 135 253 144 237 137 225 146 210 137 196 143 183 131 171 133 159 120Z",
"M183 140 L199 137 213 145 225 157 222 171 212 180 205 194 191 197 183 185 174 176 171 160Z",
"M221 173 L237 164 252 170 260 184 253 196 241 201 235 214 224 205 215 190Z",
"M232 214 L249 210 260 221 258 239 247 252 236 244 228 230Z",
"M275 145 L287 141 296 149 291 160 280 162Z",
"M298 178 L314 170 330 177 342 192 336 207 319 210 305 199Z",
"M342 216 L355 208 369 214 372 228 360 238 347 232Z",
"M80 20 L94 13 106 17 102 27 89 30Z",
"M360 78 L373 70 386 77 382 89 368 91Z"
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
    <div className="fire-world" aria-hidden="true"><img src="data:image/jpeg;base64,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" alt="" /></div>
    <div className="fire-country-list">
     {tab==="Paesi"?null:tab==="Prodotti"?funds.length?funds.map(f=><div className="fire-product" key={f.isin}><div><b>{f.ticker}</b><small>{f.name} · {f.isin}</small></div><strong>{f.qty.toLocaleString("it-IT",{maximumFractionDigits:4})} quote</strong></div>):<div className="fire-empty">Aggiungi un ETF al portafoglio per visualizzare i prodotti.</div>:<div className="fire-empty"><Info size={19}/><b>Riepilogo automatico in preparazione</b><p>Il riepilogo sarà disponibile quando avremo esposizioni e dati storici verificati.</p></div>}
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
