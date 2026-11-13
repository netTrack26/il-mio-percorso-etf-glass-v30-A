"use client";
import {useMemo,useState} from "react";
import {Globe2,Info,ArrowRight,SlidersHorizontal} from "lucide-react";

type Fund={ticker:string;name:string;isin:string;qty:number;avg:number;price:number;change:number};
type Point={date:string;value:number};
type Props={funds:Fund[];history:Point[];historyStatus:"idle"|"loading"|"ready"|"error"};
const eur=(n:number)=>n.toLocaleString("it-IT",{style:"currency",currency:"EUR"});
const pct=(n:number)=>n.toLocaleString("it-IT",{minimumFractionDigits:2,maximumFractionDigits:2})+"%";
export default function FirePortfolio({funds,history,historyStatus}:Props){
 const [tab,setTab]=useState<"Prodotti"|"Paesi"|"Riassunto AI">("Paesi");
 const [details,setDetails]=useState(false);
 const metrics=useMemo(()=>{
  if(history.length<2)return null;
  const values=history.map(p=>p.value).filter(v=>Number.isFinite(v)&&v>0);
  if(values.length<2)return null;
  const returns=values.slice(1).map((v,i)=>v/values[i]-1).filter(Number.isFinite);
  const mean=returns.reduce((s,v)=>s+v,0)/returns.length;
  const variance=returns.reduce((s,v)=>s+(v-mean)**2,0)/Math.max(1,returns.length-1);
  let peak=values[0],drawdown=0;
  values.forEach(v=>{peak=Math.max(peak,v);drawdown=Math.min(drawdown,v/peak-1);});
  const totalReturn=(values[values.length-1]/values[0]-1)*100;
  const volatility=Math.sqrt(variance)*Math.sqrt(252)*100;
  const sharpe=volatility>0?(mean*252)/(volatility/100/Math.sqrt(252)):0;
  return {totalReturn,volatility,sharpe,drawdown:drawdown*100,start:history[0].date,end:history[history.length-1].date};
 },[history]);
 const noExposure=true;
 return <div className="fire-page">
  <section className="fire-panel">
   <div className="fire-topline"><div><span className="fire-number">1</span><div><b>Portafoglio FIRE</b><small>{funds.length} prodotti in portafoglio</small></div></div><div className="fire-tabs">{(["Prodotti","Paesi","Riassunto AI"] as const).map(x=><button key={x} className={tab===x?"active":""} onClick={()=>setTab(x)}>{x}</button>)}</div></div>
   <div className="fire-exposure">
    <div className="fire-globe"><Globe2 size={156} strokeWidth={.65}/><span>ESPOSIZIONE<br/>GLOBALE</span></div>
    <div className="fire-country-list">
     {tab==="Paesi"?<div className="fire-empty"><Info size={19}/><b>Esposizione geografica non ancora disponibile</b><p>Per calcolare le percentuali per Paese servono le partecipazioni sottostanti (holdings) aggiornate di ciascun ETF. Non stimiamo né inventiamo queste percentuali.</p><small>{funds.length} ETF da analizzare</small></div>:tab==="Prodotti"?funds.length?funds.map(f=><div className="fire-product" key={f.isin}><div><b>{f.ticker}</b><small>{f.name} · {f.isin}</small></div><strong>{f.qty.toLocaleString("it-IT",{maximumFractionDigits:4})} quote</strong></div>):<div className="fire-empty">Aggiungi un ETF al portafoglio per visualizzare i prodotti.</div>:<div className="fire-empty"><Info size={19}/><b>Riepilogo AI in preparazione</b><p>Il riepilogo verrà generato quando saranno disponibili i dati completi di esposizione e rischio.</p></div>}
    </div>
   </div>
   <div className="fire-detail-action"><button onClick={()=>setDetails(v=>!v)}>Composizione dettagliata <ArrowRight size={15}/></button></div>
   {details&&<div className="fire-detail-note"><b>Dettaglio esposizioni</b><p>La ripartizione geografica, settoriale e per singolo titolo richiede i dati holdings dei fondi. Al momento il catalogo contiene le anagrafiche ETF, non le loro partecipazioni complete.</p></div>}
  </section>
  <section className="fire-metrics">
   <article><small>RITORNO CUMULATO</small><b className={metrics&&metrics.totalReturn>=0?"good":"bad"}>{metrics?pct(metrics.totalReturn):"—"}</b><span>{metrics?"Periodo selezionato":"Storico non sufficiente"}</span></article>
   <article><small>VOLATILITÀ ANNUALIZZATA</small><b>{metrics?pct(metrics.volatility):"—"}</b><span>Stima da rendimenti giornalieri</span></article>
   <article><small>SHARPE RATIO</small><b>{metrics?metrics.sharpe.toLocaleString("it-IT",{minimumFractionDigits:2,maximumFractionDigits:2}):"—"}</b><span>Assumendo tasso privo di rischio 0%</span></article>
   <article><small>DRAWDOWN MASSIMO</small><b className="bad">{metrics?pct(metrics.drawdown):"—"}</b><span>Dal picco al minimo</span></article>
  </section>
  <section className="fire-analysis panel">
   <div className="fire-analysis-head"><div><small>INTERVALLO ANALISI</small><b>{metrics?new Date(metrics.start+"T12:00:00").toLocaleDateString("it-IT",{month:"short",year:"numeric"})+" – "+new Date(metrics.end+"T12:00:00").toLocaleDateString("it-IT",{month:"short",year:"numeric"}):"In attesa di dati"}</b></div><div><small>VALUTA</small><b>EUR</b></div><div><small>RIBILANCIAMENTO</small><b>Non impostato</b></div><div><small>INVESTIMENTO</small><b>{eur(funds.reduce((s,f)=>s+f.qty*f.avg,0))}</b></div><button className="fire-settings" onClick={()=>setDetails(v=>!v)} aria-label="Dettagli analisi"><SlidersHorizontal size={16}/></button></div>
   <p>{historyStatus==="loading"?"Caricamento dello storico di mercato…":historyStatus==="error"?"Storico di mercato non disponibile: gli indicatori restano vuoti.":metrics?"Indicatori calcolati sullo storico di mercato disponibile. Sharpe con tasso privo di rischio ipotizzato pari a zero.":"Gli indicatori saranno mostrati quando saranno disponibili almeno due rilevazioni storiche valide."}</p>
   <small className="fire-disclaimer">I risultati storici non garantiscono rendimenti futuri. La composizione geografica non è disponibile senza dati holdings verificati.</small>
  </section>
 </div>;
}
