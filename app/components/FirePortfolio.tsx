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
    <div className="fire-world" aria-hidden="true"><img src="data:image/jpeg;base64,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" alt="Globo terrestre decorativo" /></div>
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
