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
   <div className="fire-exposure">
    <div className="fire-world" aria-hidden="true"><img src="data:image/jpeg;base64,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" alt="" /></div>
    <div className="fire-product-list">{funds.length?funds.map(f=><div className="fire-product" key={f.isin}><div><b>{f.ticker}</b><small>{f.name} · {f.isin}</small></div><strong>{f.qty.toLocaleString("it-IT",{maximumFractionDigits:4})} quote</strong></div>):<div className="fire-empty">Aggiungi un ETF al portafoglio per visualizzare i prodotti.</div>}</div>
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
