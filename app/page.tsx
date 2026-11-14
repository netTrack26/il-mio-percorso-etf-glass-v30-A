"use client";
import {useEffect,useMemo,useState,type ReactNode} from "react";
import {Activity,ArrowUpRight,Bell,ChartNoAxesCombined,ChevronDown,Crown,Eye,EyeOff,FileSpreadsheet,Globe2,LayoutDashboard,Menu,Plus,Search,Settings,ShieldCheck,Sparkles,Star,Wallet,X} from "lucide-react";
import FirePortfolio from "./components/FirePortfolio";
import {Area,AreaChart,Bar,BarChart,CartesianGrid,Cell,Pie,PieChart,ResponsiveContainer,Tooltip,XAxis,YAxis} from "recharts";
import {getSupabaseBrowserClient} from "../lib/supabase/client";
type Fund={ticker:string;name:string;isin:string;qty:number;avg:number;price:number;change:number};
const initial:Fund[]=[];
const catalog:Fund[]=[];
const money=(n:number)=>n.toLocaleString("it-IT",{style:"currency",currency:"EUR"});
const history:{d:string,v:number}[]=[];
function NeonBar3D(props:any){const{x,y,width,height,fill="#baf35e"}=props;const depth=Math.min(10,Math.max(5,width*.18));const rise=Math.min(9,Math.max(4,width*.14));if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(width)||!Number.isFinite(height))return null;return <g className="neon-bar-3d"><polygon points={`${x},${y} ${x+depth},${y-rise} ${x+width+depth},${y-rise} ${x+width},${y}`} fill="#e1ffad" opacity=".92"/><polygon points={`${x+width},${y} ${x+width+depth},${y-rise} ${x+width+depth},${y+height-rise} ${x+width},${y+height}`} fill="#5d9631"/><rect x={x} y={y} width={width} height={height} rx="3" fill={fill} stroke="#e2ffad" strokeWidth="1"/><rect x={x+2} y={y+2} width={Math.max(1,width-4)} height="3" rx="2" fill="#f3ffd8" opacity=".65"/></g>}
function renderAiInline(value:string):ReactNode[]{
 return value.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean).map((part,index)=>{
  if(part.startsWith("**")&&part.endsWith("**"))return <strong key={index}>{part.slice(2,-2)}</strong>;
  if(part.startsWith("*")&&part.endsWith("*"))return <em key={index}>{part.slice(1,-1)}</em>;
  return part;
 });
}
function renderAiMarkdown(source:string):ReactNode[]{
 const lines=String(source||"").replace(/\r\n?/g,"\n").split("\n");
 const blocks:ReactNode[]=[];
 let paragraph:string[]=[];
 let listItems:string[]=[];
 let listType:"ul"|"ol"|null=null;
 const flushParagraph=()=>{
  if(!paragraph.length)return;
  blocks.push(<p className="ai-md-paragraph" key={"p-"+blocks.length}>{renderAiInline(paragraph.join(" "))}</p>);
  paragraph=[];
 };
 const flushList=()=>{
  if(!listType||!listItems.length){listItems=[];listType=null;return;}
  const items=listItems;
  const type=listType;
  blocks.push(type==="ul"
   ? <ul className="ai-md-list" key={"ul-"+blocks.length}>{items.map((item,index)=><li key={index}>{renderAiInline(item)}</li>)}</ul>
   : <ol className="ai-md-list ai-md-ordered" key={"ol-"+blocks.length}>{items.map((item,index)=><li key={index}>{renderAiInline(item)}</li>)}</ol>);
  listItems=[];
  listType=null;
 };
 for(const rawLine of lines){
  const line=rawLine.trim();
  if(!line){flushParagraph();flushList();continue;}
  const heading=line.match(/^(#{1,4})\s+(.+)$/);
  if(heading){flushParagraph();flushList();blocks.push(<h4 className={"ai-md-heading ai-md-h"+heading[1].length} key={"h-"+blocks.length}>{renderAiInline(heading[2])}</h4>);continue;}
  if(/^(-{3,}|\*{3,}|_{3,})$/.test(line)){flushParagraph();flushList();blocks.push(<div className="ai-md-divider" key={"d-"+blocks.length}/>);continue;}
  const unordered=line.match(/^[-*]\s+(.+)$/);
  const ordered=line.match(/^\d+[.)]\s+(.+)$/);
  if(unordered||ordered){
   flushParagraph();
   const nextType=unordered?"ul":"ol";
   if(listType&&listType!==nextType)flushList();
   listType=nextType;
   listItems.push((unordered||ordered)![1]);
   continue;
  }
  flushList();
  paragraph.push(line);
 }
 flushParagraph();
 flushList();
 return blocks;
}
export default function Home(){
const [section,S]=useState("Overview"),[mobile,M]=useState(false),[hidden,H]=useState(false),[query,Q]=useState(""),[selectedFund,SelectFund]=useState<Fund|null>(null),[funds,F]=useState(initial),[tx,T]=useState<{id:number,isin:string,ticker:string,qty:number,price:number,fee:number,date:string,timestamp?:number,type?:string}[]>([]),[modal,D]=useState(false),[ticker,K]=useState(""),[purchaseIsin,PurchaseIsin]=useState(""),[purchaseSearchBusy,PurchaseSearchBusy]=useState(false),[purchaseSearchMessage,PurchaseSearchMessage]=useState(""),[qty,Y]=useState("1"),[price,Z]=useState("127.50"),[fee,E]=useState("6.50"),[toast,B]=useState(""),[authOpen,AuthOpen]=useState(false),[email,Email]=useState(""),[password,Password]=useState(""),[userEmail,UserEmail]=useState<string|null>(null),[authBusy,AuthBusy]=useState(false),[authMode,AuthMode]=useState<"login"|"signup">("login"),[cloudReady,CloudReady]=useState(false),[extraFunds,ExtraFunds]=useState<Fund[]>([]),[newEtfOpen,NewEtfOpen]=useState(false),[newTicker,NewTicker]=useState(""),[newIsin,NewIsin]=useState(""),[newName,NewName]=useState(""),[newIssuer,NewIssuer]=useState(""),[isinSearchBusy,IsinSearchBusy]=useState(false),[isinSearchMessage,IsinSearchMessage]=useState("");const [watchlist,Watchlist]=useState<{isin:string;ticker:string;name:string}[]>([]),[pacPlans,PacPlans]=useState<{id:string;isin:string;ticker:string;name:string;amount:number;frequency:string;active:boolean;day_of_month:number|null}[]>([]),[pacIsin,PacIsin]=useState(""),[pacAmount,PacAmount]=useState("250"),[pacFrequency,PacFrequency]=useState("monthly"),[pacDay,PacDay]=useState("1"),[pacSearch,PacSearch]=useState(""),[pacResults,PacResults]=useState<{isin:string;ticker:string;name:string;issuer:string;currency:string;exchange:string;coverage:string}[]>([]),[pacSearchBusy,PacSearchBusy]=useState(false),[pacSearchError,PacSearchError]=useState(""),[hiddenPositions,HiddenPositions]=useState<string[]>([]),[marketHistory,MarketHistory]=useState<{date:string;value:number}[]>([]),[marketHistoryStatus,MarketHistoryStatus]=useState<"idle"|"loading"|"ready"|"error">("idle"),[marketHistoryError,MarketHistoryError]=useState(""),[adjustingFund,AdjustingFund]=useState<Fund|null>(null),[adjustQuantity,AdjustQuantity]=useState(""),[adjustBusy,AdjustBusy]=useState(false);
const [stressCapital,StressCapital]=useState(""),[stressDrawdown,StressDrawdown]=useState(25),[projectionMonthly,ProjectionMonthly]=useState("250"),[projectionYears,ProjectionYears]=useState("10"),[projectionReturn,ProjectionReturn]=useState(5);
const [aiReport,AIReport]=useState<any>(null),[aiStatus,AIStatus]=useState<"idle"|"loading"|"error">("idle"),[aiError,AIError]=useState("");
useEffect(()=>{
 const supabase=getSupabaseBrowserClient();
 if(!supabase){CloudReady(true);return;}
 let active=true;
 const loadCloud=async()=>{
  const {data:{user},error:userError}=await supabase.auth.getUser();
  if(!active)return;
  if(userError){B("Impossibile verificare la sessione Supabase: "+userError.message);CloudReady(false);return;}
  if(!user){F([]);T([]);ExtraFunds([]);Watchlist([]);PacPlans([]);CloudReady(true);return;}
  const [{data:rows,error:txError},{data:etfRows,error:etfError},{data:watchRows,error:watchError},{data:pacRows,error:pacError},{data:hiddenRows,error:hiddenError}]=await Promise.all([
   supabase.from("portfolio_transactions").select("id,isin,transaction_type,quantity,unit_price,fees,currency,executed_at,notes,etfs(ticker,name)").eq("user_id",user.id).order("executed_at",{ascending:true}).order("created_at",{ascending:true}),
   supabase.from("etfs").select("isin,ticker,name,issuer").order("ticker"),
   supabase.from("watchlist").select("isin,etfs(ticker,name)").eq("user_id",user.id).order("created_at",{ascending:false}),
   supabase.from("pac_plans").select("id,isin,amount,frequency,day_of_month,active,etfs(ticker,name)").eq("user_id",user.id).order("created_at",{ascending:false}),
   supabase.from("portfolio_hidden_positions").select("isin").eq("user_id",user.id)
  ]);
  if(!active)return;
  if(txError){B("Lettura movimenti Supabase non riuscita: "+txError.message);CloudReady(false);return;}
  if(etfError){B("Lettura catalogo ETF non riuscita: "+etfError.message);CloudReady(false);return;}
  if(watchError){B("Lettura watchlist non riuscita: "+watchError.message);CloudReady(false);return;}
  if(pacError){B("Lettura PAC non riuscita: "+pacError.message);CloudReady(false);return;}
  if(hiddenError){B("Lettura posizioni nascoste non riuscita: "+hiddenError.message);CloudReady(false);return;}
  HiddenPositions((hiddenRows||[]).map((x:any)=>x.isin));
  Watchlist((watchRows||[]).map((x:any)=>({isin:x.isin,ticker:x.etfs?.ticker||x.isin,name:x.etfs?.name||x.isin})));
  PacPlans((pacRows||[]).map((x:any)=>({id:x.id,isin:x.isin,ticker:x.etfs?.ticker||x.isin,name:x.etfs?.name||x.isin,amount:Number(x.amount),frequency:x.frequency,day_of_month:x.day_of_month,active:!!x.active})));
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
   const current=grouped.get(String(row.isin))||{ticker,name,isin:String(row.isin),qty:0,avg:0,price:p,change:0};
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
   grouped.set(String(row.isin),current);
   return {id:row.id,isin:String(row.isin||""),ticker,qty:q,price:p,fee:fees,date:new Date(row.executed_at).toLocaleDateString("it-IT"),timestamp:new Date(row.executed_at).getTime(),type};
  });
  if(!active)return;
  F([...grouped.values()].filter(x=>x.qty>0 && !(hiddenRows||[]).some((h:any)=>h.isin===x.isin)));
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
  if(!session){F([]);T([]);ExtraFunds([]);Watchlist([]);PacPlans([]);CloudReady(true);return;}
  CloudReady(false);
  void loadCloud();
 });
 return()=>{active=false;subscription.unsubscribe();};
},[]);
useEffect(()=>{
 if(!tx.length){MarketHistory([]);MarketHistoryStatus("idle");MarketHistoryError("");return;}
 // Storico interno: ricostruisce il capitale netto presente nel portafoglio a ogni movimento.
 // Non interpola prezzi di mercato non disponibili; aggiunge il controvalore live come ultimo punto.
 const holdings=new Map<string,{qty:number;cost:number}>();
 const points:{date:string;value:number}[]=[];
 const ordered=[...tx].sort((a,b)=>(a.timestamp||0)-(b.timestamp||0));
 for(const movement of ordered){
  const current=holdings.get(movement.isin)||{qty:0,cost:0};
  const q=Math.max(0,Number(movement.qty)||0),p=Math.max(0,Number(movement.price)||0),fee=Math.max(0,Number(movement.fee)||0);
  if(movement.type==="buy"&&q>0){current.qty+=q;current.cost+=q*p+fee;}
  else if(movement.type==="sell"&&q>0&&current.qty>0){
   const average=current.cost/current.qty;
   const sold=Math.min(q,current.qty);
   current.qty-=sold;current.cost=Math.max(0,current.cost-average*sold);
  }
  holdings.set(movement.isin,current);
  const investedNow=[...holdings.values()].reduce((sum,h)=>sum+h.cost,0);
  points.push({date:new Date(movement.timestamp||Date.now()).toISOString().slice(0,10),value:Number(investedNow.toFixed(2))});
 }
 const currentValue=funds.reduce((sum,p)=>sum+p.qty*p.price,0);
 const today=new Date().toISOString().slice(0,10);
 if(currentValue>0)points.push({date:today,value:Number(currentValue.toFixed(2))});
 const compact=points.filter((point,index)=>index===0||point.date!==points[index-1].date||index===points.length-1);
 MarketHistory(compact);
 MarketHistoryStatus(compact.length>0?"ready":"idle");
 MarketHistoryError("");
},[tx,funds.map(p=>p.isin+":"+p.qty+":"+p.price).join("|")]);
useEffect(()=>{
 if(!userEmail||funds.length===0)return;
 let cancelled=false;
 const loadQuotes=async()=>{
  try{
   const response=await fetch("/api/portfolio-quotes",{method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",body:JSON.stringify({isins:funds.map(p=>p.isin)})});
   const payload=await response.json();
   if(!response.ok)throw new Error(payload.error||"Quotazioni non disponibili.");
   if(cancelled)return;
   const quotes=new Map((payload.quotes||[]).map((q:any)=>[q.isin,q]));
   F(old=>old.map(p=>{const q:any=quotes.get(p.isin);return q?{...p,price:Number(q.price),change:Number(q.change)||0}:p;}));
   const failures=(payload.errors||[]).length;
   if(failures)B("Quotazioni non aggiornate per "+failures+" ETF; mantenuti gli ultimi prezzi disponibili.");
  }catch(error){if(!cancelled)B(error instanceof Error?error.message:"Aggiornamento quotazioni non riuscito.");}
 };
 void loadQuotes();
 const interval=window.setInterval(()=>void loadQuotes(),5*60*1000);
 return()=>{cancelled=true;window.clearInterval(interval);};
},[userEmail,funds.map(p=>p.isin).join("|")]);

useEffect(()=>{
const q=pacSearch.trim();
 if(q.length<2){PacResults([]);PacSearchError("");PacSearchBusy(false);return;}
 let cancelled=false;
 const timer=setTimeout(async()=>{
  PacSearchBusy(true);PacSearchError("");
  try{
   const response=await fetch("/api/etf-search?q="+encodeURIComponent(q));
   const payload=await response.json();
   if(!response.ok)throw new Error(payload.error||"Ricerca ETF non disponibile.");
   if(!cancelled)PacResults(payload.results||[]);
  }catch(error){if(!cancelled)PacSearchError(error instanceof Error?error.message:"Errore di ricerca.");}
  finally{if(!cancelled)PacSearchBusy(false);}
 },350);
 return()=>{cancelled=true;clearTimeout(timer);};
},[pacSearch]);
async function selectPacFund(fund:{isin:string;ticker:string;name:string}){
 PacSearchBusy(true);PacSearchError("");
 try{
  const response=await fetch("/api/etf-search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({isin:fund.isin})});
  const payload=await response.json();
  if(!response.ok)throw new Error(payload.error||"Impossibile aggiungere l'ETF al catalogo.");
  const saved=payload.fund;
  PacIsin(saved.isin);PacSearch(saved.ticker+" · "+saved.name);
  ExtraFunds(old=>old.some(x=>x.isin===saved.isin)?old:[...old,{isin:saved.isin,ticker:saved.ticker,name:saved.name,qty:0,avg:0,price:0,change:0}]);
  PacResults([]);B("ETF verificato e aggiunto al catalogo condiviso.");
 }catch(error){PacSearchError(error instanceof Error?error.message:"Errore durante la selezione ETF.");}
 finally{PacSearchBusy(false);}
}
const allCatalog=[...catalog,...extraFunds.filter(x=>!catalog.some(y=>y.isin===x.isin))];
const total=funds.reduce((s,p)=>s+p.qty*p.price,0),invested=funds.reduce((s,p)=>s+p.qty*p.avg,0),profit=total-invested,pacMonthlyTotal=pacPlans.filter(p=>p.active).reduce((sum,p)=>sum+(p.frequency==="weekly"?p.amount*52/12:p.frequency==="quarterly"?p.amount/3:p.amount),0),fmt=(n:number)=>hidden?"••••••":money(n),analysisPalette=["#baf35e","#82b8ff","#c59cff","#ffbf69","#67d5c5","#f28eae"],analysisRows=funds.map(p=>({name:p.ticker,value:Math.max(0,p.qty*p.price),invested:p.qty*p.avg,pnl:p.qty*(p.price-p.avg),weight:total>0?(p.qty*p.price/total)*100:0})).filter(p=>p.value>0).sort((a,b)=>b.value-a.value),topWeight=analysisRows[0]?.weight||0,portfolioReturn=invested>0?(profit/invested)*100:0;
async function runAIAnalysis(){
 if(!userEmail){AIStatus("error");AIError("Accedi al tuo account per analizzare i dati personali.");return;}
 AIStatus("loading");AIError("");AIReport(null);
 try{
  const response=await fetch("/api/ai-analysis",{method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",body:JSON.stringify({currentPrices:funds.map(p=>({isin:p.isin,price:p.price}))})});
  const payload=await response.json();
  if(!response.ok)throw new Error(payload.error||"Analisi non disponibile.");
  if(!payload||!(payload.mode==="ai"||payload.mode==="rules"))throw new Error("La risposta del servizio AI non ha un formato riconosciuto.");
  if(payload.mode==="ai"&&typeof payload.analysis!=="string")throw new Error("OpenAI ha risposto senza un testo di analisi valido.");
  AIReport(payload);AIStatus("idle");
 }catch(error){AIStatus("error");AIError(error instanceof Error?error.message:"Errore durante l'analisi.");}
}
const nav=[["Overview",LayoutDashboard],["Portafoglio",Wallet],["PAC",Activity],["Simulatori",ShieldCheck],["Analisi",ChartNoAxesCombined],["AI Analysis",Sparkles],["Portafoglio FIRE",Globe2],["Premium",Crown]] as const;
async function toggleWatchlist(isin:string){
 const sb=getSupabaseBrowserClient();if(!sb||!userEmail){B("Accedi per gestire la watchlist.");return;}
 const {data:{user}}=await sb.auth.getUser();if(!user)return;
 const exists=watchlist.some(x=>x.isin===isin);
 const result=exists?await sb.from("watchlist").delete().eq("user_id",user.id).eq("isin",isin):await sb.from("watchlist").insert({user_id:user.id,isin});
 if(result.error){B("Watchlist: "+result.error.message);return;}
 const fund=allCatalog.find(x=>x.isin===isin);
 Watchlist(old=>exists?old.filter(x=>x.isin!==isin):[...old,{isin,ticker:fund?.ticker||isin,name:fund?.name||isin}]);
 B(exists?"ETF rimosso dalla watchlist.":"ETF aggiunto alla watchlist.");setTimeout(()=>B(""),3000);
}
async function savePositionAdjustment(overrideTarget?:number){
 const target=overrideTarget??Number(adjustQuantity);
 if(!adjustingFund||!Number.isFinite(target)||target<0){B("Inserisci una quantità valida.");return;}
 const sb=getSupabaseBrowserClient();if(!sb||!userEmail){B("Accedi per modificare il portafoglio.");return;}
 AdjustBusy(true);
 const {data:{user},error:userError}=await sb.auth.getUser();
 if(userError||!user){AdjustBusy(false);B("Sessione non valida. Accedi di nuovo.");return;}
 const {data:rows,error}=await sb.from("portfolio_transactions").select("transaction_type,quantity").eq("user_id",user.id).eq("isin",adjustingFund.isin).order("executed_at",{ascending:true});
 if(error){AdjustBusy(false);B("Lettura movimenti non riuscita: "+error.message);return;}
 let currentQty=0;
 for(const row of rows||[]){const q=Number(row.quantity)||0;if(row.transaction_type==="buy")currentQty+=q;else if(row.transaction_type==="sell")currentQty=Math.max(0,currentQty-q);}
 const delta=Number((target-currentQty).toFixed(8));
 if(Math.abs(delta)<0.00000001){AdjustBusy(false);AdjustingFund(null);return;}
 const transactionType=delta>0?"buy":"sell";
 const quantity=Math.abs(delta);
 const unitPrice=adjustingFund.avg>0?adjustingFund.avg:adjustingFund.price;
 if(!(unitPrice>0)){AdjustBusy(false);B("Prezzo medio non disponibile: impossibile registrare la rettifica.");return;}
 const {error:insertError}=await sb.from("portfolio_transactions").insert({user_id:user.id,isin:adjustingFund.isin,transaction_type:transactionType,quantity,unit_price:unitPrice,fees:0,currency:"EUR",notes:"Rettifica quantità posizione dall'interfaccia portafoglio"});
 AdjustBusy(false);
 if(insertError){B("Modifica non salvata: "+insertError.message);return;}
 AdjustingFund(null);
 B("Quantità aggiornata. Ricarico il portafoglio…");
 window.location.reload();
}
async function hidePortfolioPosition(isin:string){
 const sb=getSupabaseBrowserClient();if(!sb||!userEmail){B("Accedi per modificare il portafoglio.");return;}
 const {data:{user}}=await sb.auth.getUser();if(!user)return;
 const {error}=await sb.from("portfolio_hidden_positions").upsert({user_id:user.id,isin},{onConflict:"user_id,isin"});
 if(error){B("Impossibile rimuovere la posizione dalla vista: "+error.message);return;}
 HiddenPositions(old=>old.includes(isin)?old:[...old,isin]);F(old=>old.filter(x=>x.isin!==isin));
 B("ETF rimosso dal portafoglio. Lo storico dei movimenti è conservato.");setTimeout(()=>B(""),4000);
}
async function restorePortfolioPosition(isin:string){
 const sb=getSupabaseBrowserClient();if(!sb||!userEmail)return;
 const {data:{user}}=await sb.auth.getUser();if(!user)return;
 const {error}=await sb.from("portfolio_hidden_positions").delete().eq("user_id",user.id).eq("isin",isin);
 if(error){B("Ripristino non riuscito: "+error.message);return;}
 HiddenPositions(old=>old.filter(x=>x!==isin));
 const {data:rows}=await sb.from("portfolio_transactions").select("isin,transaction_type,quantity,unit_price,fees,etfs(ticker,name)").eq("user_id",user.id).eq("isin",isin);
 const relation=Array.isArray(rows?.[0]?.etfs)?rows?.[0]?.etfs[0]:rows?.[0]?.etfs;
 let qty=0,cost=0,last=0;
 for(const r of rows||[]){const q=Number(r.quantity)||0,p=Number(r.unit_price)||0,fee=Number(r.fees)||0;if(r.transaction_type==="buy"){cost+=q*p+fee;qty+=q;last=p;}else if(r.transaction_type==="sell"){qty=Math.max(0,qty-q);last=p;}}
 if(qty>0)F(old=>[...old.filter(x=>x.isin!==isin),{isin,ticker:relation?.ticker||isin,name:relation?.name||isin,qty,avg:cost/(qty||1),price:last,change:0}]);
 B("ETF ripristinato nel portafoglio.");setTimeout(()=>B(""),3000);
}
async function createPac(){
 const sb=getSupabaseBrowserClient();if(!sb||!userEmail){B("Accedi per creare un PAC.");return;}
 const {data:{user}}=await sb.auth.getUser();if(!user)return;
 const amount=Number(pacAmount),day=Number(pacDay);
 if(!pacIsin||!Number.isFinite(amount)||amount<=0||!Number.isInteger(day)||day<1||day>28){B("Controlla ETF, importo e giorno del mese (1–28).");return;}
 const {data,error}=await sb.from("pac_plans").insert({user_id:user.id,isin:pacIsin,amount,currency:"EUR",frequency:pacFrequency,day_of_month:day,active:true}).select("id,isin,amount,frequency,day_of_month,active,etfs(ticker,name)").single();
 if(error){B("Salvataggio PAC non riuscito: "+error.message);return;}
 const relation=Array.isArray(data.etfs)?data.etfs[0]:data.etfs;
 PacPlans(old=>[{id:data.id,isin:data.isin,ticker:relation?.ticker||data.isin,name:relation?.name||data.isin,amount:Number(data.amount),frequency:data.frequency,day_of_month:data.day_of_month,active:data.active},...old]);
 B("Piano PAC salvato. Ricorda: è un promemoria, non invia ordini al broker.");setTimeout(()=>B(""),4500);
}
async function updatePacStatus(id:string,active:boolean){
 const sb=getSupabaseBrowserClient();if(!sb)return;
 const {error}=await sb.from("pac_plans").update({active}).eq("id",id);
 if(error){B("Aggiornamento PAC non riuscito: "+error.message);return;}
 PacPlans(old=>old.map(x=>x.id===id?{...x,active}:x));
}
async function deletePac(id:string){
 const sb=getSupabaseBrowserClient();if(!sb)return;
 const {error}=await sb.from("pac_plans").delete().eq("id",id);
 if(error){B("Eliminazione PAC non riuscita: "+error.message);return;}
 PacPlans(old=>old.filter(x=>x.id!==id));
}
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
 const {error:unhideError}=await sb.from("portfolio_hidden_positions").delete().eq("user_id",user.id).eq("isin",etf.isin);
 if(unhideError){B("Impossibile riattivare la posizione ETF: "+unhideError.message);return;}
 const {error}=await sb.from("portfolio_transactions").insert({user_id:user.id,isin:etf.isin,transaction_type:"buy",quantity:n,unit_price:v,fees:c,currency:"EUR"});
 if(error){B("Salvataggio cloud non riuscito: "+error.message);return;}
 HiddenPositions(old=>old.filter(isin=>isin!==etf.isin));
 const old=funds.find(x=>x.isin===etf.isin);
 const base=old||{ticker:etf.ticker,name:etf.name||etf.ticker,isin:etf.isin,qty:0,avg:0,price:v,change:0};
 const nextQty=base.qty+n;
 const next={...base,qty:nextQty,avg:(base.qty*base.avg+n*v+c)/nextQty,price:v};
 F([...funds.filter(x=>x.isin!==etf.isin),next]);
 const item={id:Date.now(),isin:etf.isin,ticker:etf.ticker,qty:n,price:v,fee:c,date:new Date().toLocaleDateString("it-IT"),timestamp:Date.now(),type:"buy"};
 T([item,...tx]);
 D(false);
 PurchaseIsin("");K("");PurchaseSearchMessage("");
 B("Acquisto salvato correttamente su Supabase.");
 setTimeout(()=>B(""),4000);
}
async function searchEtfByIsin(){const isin=newIsin.trim().toUpperCase();if(!/^[A-Z]{2}[A-Z0-9]{10}$/.test(isin)){IsinSearchMessage("Inserisci un ISIN valido di 12 caratteri.");return;}const sb=getSupabaseBrowserClient();if(!sb||!userEmail){B("Accedi per cercare nel catalogo ETF.");return;}IsinSearchBusy(true);IsinSearchMessage("");const {data,error}=await sb.from("etfs").select("isin,ticker,name,issuer").eq("isin",isin).maybeSingle();IsinSearchBusy(false);if(error){IsinSearchMessage("Ricerca non riuscita: "+error.message);return;}if(!data){IsinSearchMessage("ISIN non presente nel catalogo. Puoi completare i dati manualmente e proporre l'inserimento.");return;}NewTicker(data.ticker||"");NewName(data.name||"");NewIssuer(data.issuer||"");IsinSearchMessage("ETF trovato nel catalogo: dati identificativi compilati.");}
async function addEtf(){const isin=newIsin.trim().toUpperCase(),ticker=newTicker.trim().toUpperCase(),name=newName.trim();if(!isin||!ticker||!name)return;const sb=getSupabaseBrowserClient();if(!sb||!userEmail){B("Accedi per aggiungere ETF al catalogo.");return;}const {data:{user}}=await sb.auth.getUser();const {error}=await sb.from("etfs").insert({isin,ticker,name,issuer:newIssuer.trim()||null});if(error){B(error.code==="23505"?"Questo ISIN è già presente nel catalogo.":"Impossibile aggiungere l’ETF: "+error.message);return;}ExtraFunds(old=>[...old,{ticker,name,isin,qty:0,avg:0,price:0,change:0}]);K(ticker);NewEtfOpen(false);NewTicker("");NewIsin("");NewName("");NewIssuer("");IsinSearchMessage("");B("ETF aggiunto. Ora puoi registrare il tuo acquisto.");setTimeout(()=>B(""),4000)}
const results=allCatalog.filter(x=>(x.ticker+x.name+x.isin).toLowerCase().includes(query.toLowerCase()));
if(!userEmail){
  return <main className="auth-gate"><section className="auth-gate-card"><div className="auth-gate-brand"><span>✳</span><div><b>IL MIO PERCORSO ETF</b><small>INVESTIMENTI INTELLIGENTI</small></div></div><div className="eyebrow">AREA PERSONALE · ACCESSO SICURO</div><h1>{authMode==="login"?"Bentornato.":"Inizia il tuo percorso."}</h1><p className="auth-gate-intro">{authMode==="login"?"Accedi al tuo account per visualizzare il tuo portafoglio e continuare il tuo percorso ETF.":"Crea il tuo account personale per iniziare a costruire e monitorare il tuo portafoglio ETF."}</p><div className="auth-switch"><button className={authMode==="login"?"selected":""} onClick={()=>AuthMode("login")}>Accedi</button><button className={authMode==="signup"?"selected":""} onClick={()=>AuthMode("signup")}>Crea account</button></div><label>Email<input type="email" autoComplete="email" value={email} onChange={e=>Email(e.target.value)} placeholder="nome@email.com"/></label><label>Password<input type="password" autoComplete={authMode==="login"?"current-password":"new-password"} value={password} onChange={e=>Password(e.target.value)} placeholder="Almeno 8 caratteri"/></label><button className="primary auth-submit" disabled={authBusy||!email||password.length<8} onClick={async()=>{const sb=getSupabaseBrowserClient();if(!sb){B("Servizio di accesso non configurato. Contatta l’amministratore.");return;}AuthBusy(true);const result=authMode==="login"?await sb.auth.signInWithPassword({email,password}):await sb.auth.signUp({email,password});AuthBusy(false);if(result.error){B(result.error.message);}else if(authMode==="signup"&&!result.data.session){B("Account creato: controlla la tua email per confermare l’indirizzo.");}else{B("Accesso effettuato");}setTimeout(()=>B(""),4500);}}>{authBusy?"Attendere…":authMode==="login"?"Accedi":"Crea account"}</button>{toast&&<div className="auth-gate-message" role="status">{toast}</div>}<small className="auth-gate-foot">I tuoi dati e le tue operazioni sono personali e protetti.</small></section></main>;
 }
return <main className="shell"><aside className={"sidebar "+(mobile?"open":"")}><div className="brand"><div className="mark">✳</div><div className="brandcopy"><b>IL MIO PERCORSO ETF</b><small>INVESTIMENTI INTELLIGENTI</small></div><button className="close" onClick={()=>M(false)}><X/></button></div><div className="side-label">WORKSPACE</div><nav>{nav.map(([label,Icon])=><button key={label} className={"nav "+(section===label?"active":"")} onClick={()=>{S(label);M(false)}}><Icon size={19}/><span>{label}</span></button>)}</nav><div className="push"/><button className={"nav "+(section==="Impostazioni"?"active":"")} onClick={()=>{S("Impostazioni");M(false)}}><Settings size={19}/><span>Impostazioni</span></button>{userEmail?.toLowerCase()==="memu86@hotmail.it"&&<a className="nav" href="/admin" style={{textDecoration:"none"}}><ShieldCheck size={19}/><span>Amministratore</span></a>}<div className="user"><div className="avatar">{userEmail?userEmail[0].toUpperCase():"M"}</div><div><b>{userEmail||"Modalità demo"}</b><small>{userEmail?"Account Supabase":"Account locale"}</small></div></div></aside>
<section className="main"><header className="top"><button className="icon mobilemenu" onClick={()=>M(true)}><Menu/></button><div className="tabs">{["Overview","Portafoglio","Analisi","Simulatori"].map(x=><button key={x} className={x===section?"sel":""} onClick={()=>S(x)}>{x}</button>)}</div><div className="actions"><span className="market"><i/> {userEmail?"ACCOUNT CLOUD":"DEMO MODE"}</span><button className="icon" onClick={()=>H(!hidden)}>{hidden?<EyeOff/>:<Eye/>}</button><button className="icon"><Bell/></button><button className="auth-trigger" onClick={()=>AuthOpen(true)}>{userEmail?"Account":"Accedi"}</button><div className="avatar small">{userEmail?userEmail[0].toUpperCase():"M"}</div></div></header>
<div className="content"><div className="heading"><div><div className="eyebrow">{new Date().toLocaleDateString("it-IT",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).toUpperCase()}</div><h1>{section==="Overview"?"Bentornato nel tuo percorso.":section}</h1><p>Una visione chiara dei tuoi investimenti, un passo alla volta.</p></div><button className="primary" onClick={()=>D(true)}><Plus size={16}/> Registra acquisto</button></div>
{section === "Overview" && (
  <>
    <div className="kpis">
      <Kpi label="Controvalore stimato" value={total} format={fmt} note="Aggiornato con le ultime quotazioni disponibili" />
      <Kpi label="Capitale investito" value={invested} format={fmt} note="Costo medio effettivo delle quote detenute" />
      <Kpi label="Profitto / perdita" value={profit} format={(n) => (n >= 0 ? "+ " : "") + fmt(n)} note={((profit / (invested || 1)) * 100).toFixed(2) + "%"} />
      <Kpi label="PAC mensile" value={pacMonthlyTotal} format={fmt} note={pacPlans.some(p=>p.active)?"Totale mensile equivalente dei piani attivi":"Nessun PAC attivo"} />
    </div>
    <div className="grid">
      <section className="panel chart">
        <div className="market-line-heading"><div><span className="eyebrow">MARKET PULSE · PORTFOLIO</span><h2>Andamento del portafoglio</h2><p>Capitale investito ricostruito dalle operazioni, con il valore attuale del portafoglio come ultimo punto.</p></div><span className={"market-line-status "+(marketHistoryStatus==="ready"?"positive":"")}>{marketHistoryStatus==="loading"?"AGGIORNAMENTO":marketHistoryStatus==="ready"?"ANDAMENTO PORTAFOGLIO":"DATI NON DISPONIBILI"}</span></div>
        <div className="market-line-summary"><div><small>CONTROVALORE ATTUALE</small><b><AnimatedNumber value={total} format={fmt}/></b></div><span className="market-line-meta">{tx.length} MOVIMENTI REGISTRATI</span></div>
        <div className="market-line-chart">
          {marketHistoryStatus==="loading"?<div className="market-line-message">Caricamento delle quotazioni storiche…</div>:marketHistoryStatus==="error"?<div className="market-line-message market-line-error"><b>Andamento non ancora disponibile</b><span>{marketHistoryError}</span></div>:marketHistoryStatus==="ready"?<ResponsiveContainer width="100%" height="100%"><AreaChart data={marketHistory} margin={{top:18,right:8,left:0,bottom:0}}><defs><linearGradient id="marketLineFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={marketHistory[marketHistory.length-1].value>=marketHistory[0].value?"#baf35e":"#ff7777"} stopOpacity={.3}/><stop offset="100%" stopColor={marketHistory[marketHistory.length-1].value>=marketHistory[0].value?"#baf35e":"#ff7777"} stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#ffffff12" vertical={false} strokeDasharray="3 6"/><XAxis dataKey="date" tickFormatter={(v)=>new Date(v+"T12:00:00").toLocaleDateString("it-IT",{month:"short",year:"2-digit"})} minTickGap={30} tick={{fontSize:9,fill:"#aeb0b7"}} tickLine={false} axisLine={false}/><YAxis hide domain={["dataMin","dataMax"]}/><Tooltip labelFormatter={(v)=>new Date(String(v)+"T12:00:00").toLocaleDateString("it-IT",{day:"2-digit",month:"long",year:"numeric"})} formatter={(v)=>money(Number(v))} contentStyle={{background:"#111a17",border:"1px solid #baf35e55",borderRadius:12,color:"#fff"}}/><Area type="monotone" dataKey="value" name="Capitale investito / valore attuale" stroke={marketHistory[marketHistory.length-1].value>=marketHistory[0].value?"#caff7d":"#ff7777"} strokeWidth={2.8} fill="url(#marketLineFill)" activeDot={{r:5,stroke:"#fff",strokeWidth:2}} dot={false}/></AreaChart></ResponsiveContainer>:<div className="market-line-message">{funds.length===0?"Aggiungi un ETF al portafoglio per visualizzare l'andamento del mercato.":"Accedi al tuo account per caricare le quotazioni storiche del portafoglio."}</div>}
        </div>
        <div className="market-line-footer"><span>FONTE: MOVIMENTI DEL TUO PORTAFOGLIO</span><span>{marketHistoryStatus==="ready"?"Ultima rilevazione: "+new Date(marketHistory[marketHistory.length-1].date+"T12:00:00").toLocaleDateString("it-IT"):"I punti storici derivano dalle operazioni registrate; l’ultimo valore usa le quotazioni disponibili."}</span></div>
      </section>
      <section className="panel allocation">
        <div className="panelhead"><div><h2>Composizione</h2><p>Distribuzione indicativa</p></div></div>
        {analysisRows.length===0?<div className="empty-state">La composizione apparirà dopo aver inserito le tue posizioni.</div>:<><div className="dashboard-allocation-chart"><ResponsiveContainer width="100%" height={190}><PieChart><Pie data={analysisRows} dataKey="value" nameKey="name" innerRadius={53} outerRadius={76} paddingAngle={3} stroke="none">{analysisRows.map((entry,index)=><Cell key={entry.name} fill={analysisPalette[index%analysisPalette.length]}/>)}</Pie><Tooltip formatter={(v)=>money(Number(v))} contentStyle={{background:"#28292e",border:"1px solid #ffffff25",borderRadius:10,color:"#fff"}}/></PieChart></ResponsiveContainer><div className="dashboard-allocation-center"><b>{funds.length}</b><small>ETF</small></div></div><div className="dashboard-allocation-legend">{analysisRows.slice(0,4).map((entry,index)=><div key={entry.name}><i style={{background:analysisPalette[index%analysisPalette.length]}}/><span>{entry.name}</span><b>{entry.weight.toLocaleString("it-IT",{maximumFractionDigits:1})}%</b></div>)}</div></>}
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
          <button onClick={() => S("PAC")}><Search />Ottimizza PAC</button>
          <button onClick={() => S("PAC")}><Activity />Piano PAC</button>
          <button onClick={() => S("Analisi")}><ChartNoAxesCombined />Analisi portafoglio</button>
        </div>
        <div className="insight"><b>Il tuo percorso, un passo alla volta.</b><p>La costanza nel tempo conta più delle oscillazioni di breve periodo.</p></div>
      </section>
    </div>
  </>
)}
{section==="Portafoglio FIRE"&&<FirePortfolio funds={funds} history={marketHistory} historyStatus={marketHistoryStatus}/>}{section==="Impostazioni"&&<div className="settings-page"><section className="panel section settings-hero"><div className="eyebrow">PREFERENZE PERSONALI</div><h2>Impostazioni</h2><p>Gestisci la visualizzazione e il tuo accesso alla piattaforma.</p></section><section className="panel section settings-card"><div className="settings-row"><div><b>Mostra valori del portafoglio</b><small>Nascondi o visualizza gli importi nelle schermate.</small></div><button className={"settings-toggle "+(!hidden?"enabled":"")} aria-pressed={!hidden} onClick={()=>H(!hidden)}><span/></button></div><div className="settings-row"><div><b>Account</b><small>{userEmail||"Non hai effettuato l'accesso"}</small></div><button className="secondary" onClick={()=>AuthOpen(true)}>{userEmail?"Gestisci account":"Accedi"}</button></div><div className="settings-row"><div><b>Sincronizzazione</b><small>{cloudReady&&userEmail?"Account collegato a Supabase":"Accedi per sincronizzare i tuoi dati personali"}</small></div><span className={"settings-pill "+(cloudReady&&userEmail?"online":"offline")}>{cloudReady&&userEmail?"COLLEGATO":"NON COLLEGATO"}</span></div>{userEmail&&<div className="settings-row"><div><b>Esci dall'account</b><small>Termina la sessione su questo dispositivo.</small></div><button className="secondary" onClick={async()=>{const sb=getSupabaseBrowserClient();if(sb)await sb.auth.signOut();AuthOpen(false);B("Disconnessione completata");}}>Esci</button></div>}</section><p className="muted">Le impostazioni disponibili verranno ampliate nelle prossime versioni.</p></div>}{section==="Premium"&&<div className="premium-page"><section className="premium-hero"><div className="premium-orbit premium-orbit-one"/><div className="premium-orbit premium-orbit-two"/><div className="premium-hero-copy"><span className="premium-kicker"><Crown size={14}/> IL PROSSIMO LIVELLO DEL TUO PERCORSO</span><h2>Investi con una<br/><em>visione più ampia.</em></h2><p>Strumenti evoluti per leggere il portafoglio, scoprire opportunità e prendere decisioni con maggiore consapevolezza.</p><div className="premium-status"><span className="premium-status-dot"/> ACCESSO IN PREPARAZIONE</div></div><div className="premium-visual" aria-hidden="true"><div className="premium-core"><Crown size={34}/><b>PRO</b><small>INSIGHT ENGINE</small></div><div className="premium-ring premium-ring-a"/><div className="premium-ring premium-ring-b"/><span className="premium-orbit-label label-one">ANALISI</span><span className="premium-orbit-label label-two">STRATEGIA</span><span className="premium-orbit-label label-three">CONTROLLO</span></div></section><div className="premium-section-heading"><div className="eyebrow">IN ARRIVO CON PREMIUM</div><h2>Più profondità. Più controllo.</h2><p>Un'anteprima delle funzionalità che stiamo preparando.</p></div><div className="premium-feature-grid"><article className="premium-feature"><div className="premium-feature-icon"><ChartNoAxesCombined/></div><span>01 · PORTAFOGLIO</span><h3>Analisi avanzata</h3><p>Concentrazione, esposizioni e indicatori per capire meglio come è costruito il tuo portafoglio.</p><b>PORTFOLIO INTELLIGENCE</b></article><article className="premium-feature"><div className="premium-feature-icon"><Search/></div><span>02 · RICERCA</span><h3>ETF explorer evoluto</h3><p>Schede più complete, filtri approfonditi e strumenti per confrontare fondi e caratteristiche.</p><b>DEEP ETF DISCOVERY</b></article><article className="premium-feature"><div className="premium-feature-icon"><Activity/></div><span>03 · STRATEGIA</span><h3>PAC intelligente</h3><p>Simulazioni di frequenza, commissioni e costi per valutare piani di accumulo più efficienti.</p><b>SMART PAC LAB</b></article><button type="button" className="premium-feature risk-feature" onClick={()=>S("Simulatori")}><div className="premium-feature-icon"><ShieldCheck/></div><span>04 · RISCHIO</span><h3>Scenari e stress test</h3><p>Simulatore gratuito già disponibile: prova ribassi di mercato e proiezioni PAC.</p><b>DISPONIBILE GRATIS · APRI SIMULATORE ↗</b></button></div><section className="premium-bottom"><div><span className="premium-kicker">IL TUO PROSSIMO PASSO</span><h2>Stiamo costruendo qualcosa di speciale.</h2><p>Premium non è ancora attivo. Questa anteprima non comporta iscrizioni, pagamenti o addebiti.</p></div><span className="premium-coming">COMING SOON <Crown size={17}/></span></section></div>}{section==="Portafoglio"&&<div className="portfolio-page"><section className="portfolio-hero"><div><span className="eyebrow">IL TUO CAPITALE · LIVE ACCOUNT</span><h2>Il tuo portafoglio,<br/><em>in un unico sguardo.</em></h2><p>Le tue posizioni e i movimenti registrati, organizzati in modo chiaro.</p></div><button className="primary" onClick={()=>D(true)}><Plus size={16}/> Nuovo acquisto</button><div className="portfolio-total"><small>VALORE DELLE POSIZIONI</small><b>{fmt(total)}</b><span>{funds.length} ETF · {money(invested)} capitale registrato</span></div><div className="portfolio-hero-orb"/></section><div className="portfolio-stat-grid"><div className="portfolio-stat"><span>CAPITALE INVESTITO</span><b>{fmt(invested)}</b><small>Costo medio delle posizioni</small></div><div className="portfolio-stat"><span>RISULTATO REGISTRATO</span><b className={profit>=0?"positive":"negative"}>{profit>=0?"+":""}{fmt(profit)}</b><small>Valore meno capitale registrato</small></div><div className="portfolio-stat"><span>POSIZIONI ATTIVE</span><b>{funds.length.toString().padStart(2,"0")}</b><small>ETF presenti nel portafoglio</small></div></div><section className="portfolio-positions panel"><div className="panelhead"><div><span className="eyebrow">HOLDINGS · OVERVIEW</span><h2>Le tue posizioni</h2><p>Valore calcolato con l'ultimo prezzo registrato.</p></div><span className="tag">{funds.length} ASSET</span></div>{funds.length===0?<p className="empty-state">Il tuo portafoglio è pronto. Registra il primo acquisto per vedere qui le tue posizioni.</p>:<div className="portfolio-position-list">{funds.map((p,index)=>{const value=p.qty*p.price,weight=total>0?value/total*100:0,pnl=p.qty*(p.price-p.avg);return <article className="portfolio-position" key={p.isin}><div className="portfolio-position-symbol">{p.ticker.slice(0,2)}</div><div className="portfolio-position-main"><div className="portfolio-position-title"><b>{p.ticker}</b><span>{p.isin}</span></div><small>{p.name}</small><div className="portfolio-weight-track"><i style={{width:weight+"%"}}/></div></div><div className="portfolio-position-value"><b>{fmt(value)}</b><small>{weight.toLocaleString("it-IT",{maximumFractionDigits:1})}% del portafoglio</small></div><div className={"portfolio-position-pnl "+(pnl>=0?"positive":"negative")}>{pnl>=0?"+":""}{fmt(pnl)}</div><button className="secondary portfolio-remove" onClick={()=>{AdjustingFund(p);AdjustQuantity(String(p.qty));}}>Modifica / elimina</button></article>})}</div>}<div className="portfolio-footer-total"><span>Valore complessivo</span><b>{fmt(total)}</b></div></section></div>}
{section==="Esplora ETF"&&<section className="panel section"><div className="panelhead"><div><h2>Esplora ETF</h2><p>Cerca uno strumento o aggiungilo tramite ISIN.</p></div><button className="primary" onClick={()=>NewEtfOpen(true)}><Plus/> Aggiungi ETF</button></div><div className="search"><Search/><input placeholder="Cerca ticker, nome o ISIN..." value={query} onChange={e=>{Q(e.target.value);SelectFund(null)}}/></div><>{results.map(p=><div className="explorerow" key={p.ticker} role="button" tabIndex={0} aria-label={"Apri dettagli " + p.ticker} onClick={()=>SelectFund(p)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();SelectFund(p)}}}><div className="ticker">{p.ticker[0]}</div><div className="fund"><b>{p.ticker}</b><small>{p.name}</small><small>{p.isin}</small></div><strong>{money(p.price)}</strong><button className="icon" aria-label={watchlist.some(w=>w.isin===p.isin)?"Rimuovi dalla watchlist":"Aggiungi alla watchlist"} onClick={e=>{e.stopPropagation();void toggleWatchlist(p.isin)}}><Star size={16} fill={watchlist.some(w=>w.isin===p.isin)?"#c6f879":"none"} color="#c6f879"/></button><button className="icon" aria-label={"Registra acquisto " + p.ticker} onClick={e=>{e.stopPropagation();K(p.ticker);Z(String(p.price));D(true)}}><Plus/></button></div>)}{selectedFund&&<section className="fund-detail"><div className="panelhead"><div><span className="tag">SCHEDA ETF · DATI DEMO</span><h2>{selectedFund.name}</h2><p>{selectedFund.ticker} · ISIN {selectedFund.isin}</p></div><button className="icon" aria-label="Chiudi dettagli ETF" onClick={()=>SelectFund(null)}><X/></button></div><div className="fund-detail-grid"><div><small>Prezzo indicativo</small><b>{money(selectedFund.price)}</b></div><div><small>Variazione dimostrativa</small><b className={selectedFund.change>=0?"positive":"negative"}>{selectedFund.change>=0?"+":""}{selectedFund.change.toLocaleString("it-IT")}%</b></div></div><p className="muted">Queste informazioni appartengono al catalogo dimostrativo della V30 e non sono quotazioni in tempo reale né una scheda ufficiale dell'emittente.</p><button className="primary" onClick={()=>{K(selectedFund.ticker);Z(String(selectedFund.price));D(true)}}><Plus size={16}/> Registra acquisto</button></section>}</></section>}
{section==="Watchlist"&&<section className="panel section"><div className="panelhead"><div><h2>Watchlist</h2><p>I tuoi ETF salvati, sincronizzati con il tuo account.</p></div><span className="tag">{watchlist.length} ETF</span></div>{!userEmail?<p className="empty-state">Accedi per salvare e sincronizzare la tua watchlist.</p>:watchlist.length===0?<p className="empty-state">La watchlist è vuota. Apri Esplora ETF e premi la stella per aggiungere uno strumento.</p>:watchlist.map(p=><div className="explorerow" key={p.isin}><Star color="#c6f879"/><div className="fund"><b>{p.ticker}</b><small>{p.name} · {p.isin}</small></div><button className="secondary" onClick={()=>toggleWatchlist(p.isin)}>Rimuovi</button></div>)}</section>}
{section==="PAC"&&<div className="pac-page"><section className="pac-hero"><div><span className="eyebrow">STRATEGIA DI ACCUMULO · YOUR PLAN</span><h2>Costruisci il tuo<br/><em>percorso nel tempo.</em></h2><p>Organizza i versamenti, monitora i piani attivi e mantieni la tua strategia sotto controllo.</p></div><div className="pac-hero-amount"><small>IMPEGNO MENSILE EQUIVALENTE</small><b>{fmt(pacMonthlyTotal)}</b><span>{pacPlans.filter(p=>p.active).length} piani attivi</span><div className="pac-signal"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div></div></section><div className="pac-workspace"><section className="panel section pac-create"><div className="pac-section-heading"><span className="eyebrow">01 · CONFIGURA</span><h2>Crea un piano PAC</h2><p>Un promemoria personale: non invia ordini al broker.</p></div>{!userEmail?<p className="empty-state">Accedi per salvare i tuoi piani PAC.</p>:<><label>Cerca ETF per ISIN, ticker o nome<input value={pacSearch} onChange={e=>{PacSearch(e.target.value);PacIsin("");}} placeholder="Es. IE00BFMXXD54, VUAA, Vanguard S&P 500"/></label><div className="pac-search-results">{pacSearch.trim().length<2?<p className="muted">Digita almeno 2 caratteri: cerchiamo nel catalogo ETF esterno, non soltanto in Supabase.</p>:pacSearchError?<p className="pac-error" role="alert">{pacSearchError}</p>:pacSearchBusy?<p className="muted">Ricerca o selezione ETF in corso…</p>:pacResults.length>0?pacResults.map(x=><button type="button" className="explorerow" key={x.isin} disabled={pacSearchBusy} onClick={()=>void selectPacFund(x)}><Search/><span className="fund"><b>{x.ticker||x.isin}</b><small>{x.name} · {x.isin}</small><small>{x.exchange||"Mercato non indicato"} · {x.currency||"Valuta non indicata"} · {x.coverage==="covered"?"Scheda disponibile":"Scheda da caricare"}</small></span><span>Seleziona</span></button>):<p className="muted">Nessun risultato. Prova con ISIN completo, ticker o nome dell'emittente.</p>}</div>{pacIsin&&<p className="muted">ETF selezionato: <b>{pacIsin}</b></p>}<label>Importo (€)<input type="number" min="1" step="1" value={pacAmount} onChange={e=>PacAmount(e.target.value)}/></label><label>Frequenza<select className="pac-frequency-select" value={pacFrequency} onChange={e=>PacFrequency(e.target.value)}><option value="weekly">Settimanale</option><option value="monthly">Mensile</option><option value="quarterly">Trimestrale</option></select></label><label>Giorno del mese (1–28)<input type="number" min="1" max="28" value={pacDay} onChange={e=>PacDay(e.target.value)}/></label><button className="primary pac-save" onClick={createPac}>Salva piano PAC <ArrowUpRight size={15}/></button></>}</section><section className="panel section pac-plans"><div className="pac-section-heading"><span className="eyebrow">02 · MONITORAGGIO</span><h2>I tuoi piani</h2><p>{pacPlans.length} piani salvati nel tuo account.</p></div>{pacPlans.length===0?<p className="empty-state">I tuoi piani appariranno qui dopo il primo salvataggio.</p>:<div className="pac-plan-list">{pacPlans.map((p,index)=><article className="pac-plan-card" key={p.id}><div className="pac-plan-top"><span className="pac-plan-index">PLAN 0{index+1}</span><span className={"pac-plan-status "+(p.active?"active":"paused")}>{p.active?"ATTIVO":"IN PAUSA"}</span></div><div className="pac-plan-identity"><div className="pac-plan-symbol"><Activity size={18}/></div><div><b>{p.ticker}</b><small>{p.name}</small></div></div><div className="pac-plan-amount">{money(p.amount)}<small> / {p.frequency==="monthly"?"mese":p.frequency==="weekly"?"settimana":"trimestre"}</small></div><div className="pac-plan-meta"><span>Frequenza</span><b>{p.frequency==="monthly"?"Mensile":p.frequency==="weekly"?"Settimanale":"Trimestrale"}</b><span>Giorno</span><b>{p.day_of_month||"—"}</b></div><div className="pac-plan-actions"><button className="secondary" onClick={()=>updatePacStatus(p.id,!p.active)}>{p.active?"Metti in pausa":"Riattiva piano"}</button><button className="icon" aria-label="Elimina piano" onClick={()=>{if(confirm("Eliminare questo piano PAC?"))void deletePac(p.id)}}><X size={16}/></button></div></article>)}</div>}</section></div></div>}
{section==="Simulatori"&&<div className="simulator-page">
 <section className="simulator-hero panel"><div><span className="eyebrow">LAB GRATUITO · RISCHIO E STRATEGIA</span><h2>Metti alla prova<br/><em>il tuo percorso.</em></h2><p>Simula ribassi di mercato e piani di accumulo con ipotesi modificabili. I risultati sono matematici, non previsioni né promesse di rendimento.</p></div><div className="simulator-hero-mark"><ShieldCheck size={34}/><b>RISK LAB</b><small>100% GRATUITO</small></div></section>
 <div className="simulator-grid">
  <section className="panel simulator-card">
   <div className="simulator-card-head"><div><span className="eyebrow">01 · STRESS TEST</span><h2>Quanto potrebbe perdere il portafoglio?</h2><p>Applica uno shock uniforme al valore scelto e osserva l'impatto stimato.</p></div><span className="simulator-free">GRATIS</span></div>
   <label className="simulator-field">Valore di partenza (€)<input type="number" min="0" step="100" value={stressCapital||String(Math.round(total>0?total:invested>0?invested:10000))} onChange={e=>StressCapital(e.target.value)} /></label>
   <div className="simulator-presets"><span>SCENARI RAPIDI</span>{[10,20,30,40,50].map(v=><button type="button" key={v} className={stressDrawdown===v?"selected":""} onClick={()=>StressDrawdown(v)}>-{v}%</button>)}</div>
   <label className="simulator-range-label"><span>Ribasso ipotizzato</span><b>-{stressDrawdown}%</b><input type="range" min="0" max="60" step="1" value={stressDrawdown} onChange={e=>StressDrawdown(Number(e.target.value))}/></label>
   <div className="stress-results"><div><small>PERDITA IPOTETICA</small><b className="negative">-{money((Number(stressCapital)>0?Number(stressCapital):(total>0?total:invested>0?invested:10000))*stressDrawdown/100)}</b></div><div><small>VALORE DOPO IL RIBASSO</small><b>{money((Number(stressCapital)>0?Number(stressCapital):(total>0?total:invested>0?invested:10000))*(1-stressDrawdown/100))}</b></div><div><small>RIALZO PER RECUPERARE</small><b className="positive">{(stressDrawdown>=100?0:stressDrawdown/Math.max(1,100-stressDrawdown)*100).toLocaleString("it-IT",{maximumFractionDigits:1})}%</b></div></div>
   <div className="simulator-disclaimer">Esempio teorico: il ribasso viene applicato nello stesso modo a tutte le posizioni. Non rappresenta una previsione e non considera correlazioni, valute, tasse o costi.</div>
   {funds.length>0&&<div className="stress-holdings"><h3>Impatto stimato sulle tue posizioni</h3>{funds.map(f=>{const value=f.qty*f.price;return <div className="stress-holding" key={f.isin}><span><b>{f.ticker}</b><small>{f.name}</small></span><span><b>{money(value*(1-stressDrawdown/100))}</b><small className="negative">-{money(value*stressDrawdown/100)}</small></span></div>})}</div>}
  </section>
  <section className="panel simulator-card">
   <div className="simulator-card-head"><div><span className="eyebrow">02 · PROIEZIONE PAC</span><h2>Quanto potresti accumulare?</h2><p>Modifica versamento, durata e rendimento ipotetico annuo.</p></div><span className="simulator-free">GRATIS</span></div>
   <label className="simulator-field">Versamento mensile (€)<input type="number" min="0" step="10" value={projectionMonthly} onChange={e=>ProjectionMonthly(e.target.value)}/></label>
   <div className="simulator-form-row"><label className="simulator-field">Durata (anni)<input type="number" min="1" max="50" value={projectionYears} onChange={e=>ProjectionYears(e.target.value)}/></label><label className="simulator-field">Rendimento annuo ipotetico<input type="number" min="0" max="15" step=".5" value={projectionReturn} onChange={e=>ProjectionReturn(Math.max(0,Math.min(15,Number(e.target.value)||0)))}/></label></div>
   <div className="projection-results"><small>CAPITALE VERSATO</small><b>{money(Math.max(0,Number(projectionMonthly)||0)*Math.max(1,Math.min(600,(Number(projectionYears)||1)*12)))}</b><small>VALORE FINALE IPOTETICO</small><strong>{(()=>{const months=Math.max(1,Math.min(600,(Number(projectionYears)||1)*12)),amount=Math.max(0,Number(projectionMonthly)||0),rate=Math.max(0,Math.min(15,projectionReturn))/1200,future=rate===0?amount*months:amount*((Math.pow(1+rate,months)-1)/rate);return money(future);})()}</strong><small>La differenza è una simulazione lorda, non garantita.</small></div>
   <div className="simulator-disclaimer">La proiezione considera versamenti a fine mese e capitalizzazione mensile. Non include capitale iniziale, inflazione, imposte, commissioni o oscillazioni reali dei mercati.</div>
  </section>
 </div>
 <section className="panel simulator-howto"><div><span className="eyebrow">COME USARLO</span><h2>Tre passaggi, nessun costo</h2></div><div className="simulator-steps"><div><b>01</b><span>Imposta il valore del portafoglio e seleziona un ribasso.</span></div><div><b>02</b><span>Osserva perdita potenziale, valore residuo e recupero necessario.</span></div><div><b>03</b><span>Prova un PAC con importo, durata e rendimento differenti.</span></div></div></section>
</div>}
{section==="AI Analysis"&&<div className="ai-analysis-page">
 <section className="panel ai-hero"><div><span className="eyebrow">INTELLIGENZA ARTIFICIALE · PORTAFOGLIO</span><h2>AI <em>Analysis</em></h2><p>Calcoli trasparenti sui tuoi movimenti, interpretati dall'intelligenza artificiale quando il servizio è configurato. Nessuna operazione viene eseguita sul broker.</p><div className="ai-hero-tags"><span><ShieldCheck size={13}/> Dati del tuo account</span><span><Sparkles size={13}/> Analisi ibrida</span><span><Activity size={13}/> Nessun ordine automatico</span></div></div><div className="ai-hero-icon"><Sparkles size={38}/><b>AI INSIGHTS</b><small>PORTFOLIO INTELLIGENCE</small></div></section>
 <section className="panel ai-run-card"><div><span className="eyebrow">ANALISI SU RICHIESTA</span><h3>Analizza il tuo portafoglio</h3><p>Legge le operazioni e i piani PAC del tuo account. I calcoli quantitativi restano interni; l'AI aggiunge interpretazione e spiegazioni.</p></div><button className="primary" onClick={runAIAnalysis} disabled={aiStatus==="loading"||!userEmail}><Sparkles size={16}/>{aiStatus==="loading"?"Analisi in corso…":"Avvia AI Analysis"}</button>{!userEmail&&<small className="ai-muted">Accedi per utilizzare l'analisi personale.</small>}{aiError&&<div className="ai-error">{aiError}</div>}</section>
 {aiReport&&<><div className="ai-result-meta"><span className="ai-mode"><i/>{aiReport.mode==="ai"?"OPENAI AI + CALCOLI INTERNI":"CALCOLI INTERNI · MODALITÀ BASE"}</span><small>Generata il {new Date(aiReport.generatedAt).toLocaleString("it-IT")}</small></div>
 <section className="panel ai-result-card"><div className="ai-result-heading"><div><span className="eyebrow">01 · SINTESI</span><h3>{aiReport.mode==="ai"?"Lettura intelligente del portafoglio":aiReport.summary}</h3></div><Sparkles color="#baf35e"/></div>{aiReport.analysis?<div className="ai-markdown">{renderAiMarkdown(aiReport.analysis)}</div>:<div className="ai-insight-list">{(aiReport.attention||[]).map((item:string,i:number)=><div className="ai-insight" key={i}><span>{String(i+1).padStart(2,"0")}</span><p>{item}</p></div>)}</div>}</section>
 <section className="panel ai-quote-audit"><div className="ai-quote-audit-head"><span className="eyebrow">VERIFICA QUOTAZIONI</span><b>{aiReport.facts?.liveQuoteCount||0}/{aiReport.facts?.holdings?.length||0} aggiornate entro 36 ore</b></div>{(aiReport.facts?.holdings||[]).map((holding:any)=><div className="ai-quote-row" key={holding.isin}><div><b>{holding.ticker}</b><small>{holding.quote?.source||"Fonte non disponibile"} · {holding.quote?.symbol||"Simbolo non verificato"}</small></div><div className="ai-quote-status"><i className={holding.quote?.freshness==="fresh"?"fresh":holding.quote?.freshness==="delayed"?"delayed":"missing"}/><span>{holding.quote?.freshness==="fresh"?"Timestamp recente":holding.quote?.freshness==="delayed"?"Prezzo datato":"Prezzo non disponibile"}</span></div><time>{holding.quote?.time?new Date(holding.quote.time).toLocaleString("it-IT"):"Nessun timestamp"}</time></div>)}</section>
 <div className="ai-metrics-grid"><article className="panel ai-metric"><small>CAPITALE RICOSTRUITO</small><b>{money(aiReport.facts?.invested||0)}</b><span>Da movimenti registrati</span></article><article className="panel ai-metric"><small>VALORE STIMATO</small><b>{money(aiReport.facts?.currentValue||0)}</b><span>{aiReport.facts?.liveQuoteCount===aiReport.facts?.holdings?.length&&aiReport.facts?.holdings?.length>0?"Quotazioni ricevute per tutte le posizioni":aiReport.facts?.liveQuoteCount>0?String(aiReport.facts.liveQuoteCount)+"/"+String(aiReport.facts.holdings?.length||0)+" quotazioni ricevute; le altre usano il costo medio":"Prezzi non aggiornati: viene usato il costo medio"}</span></article><article className="panel ai-metric"><small>ETF ATTIVI</small><b>{aiReport.facts?.holdings?.length||0}</b><span>Posizioni ricostruite</span></article><article className="panel ai-metric"><small>PAC MENSILE</small><b>{money(aiReport.facts?.activePacMonthlyEquivalent||0)}</b><span>Equivalente dei piani attivi</span></article></div>
 {aiReport.mode==="rules"&&<div className="ai-two-columns"><section className="panel ai-result-card"><span className="eyebrow">02 · PUNTI DI FORZA</span><h3>Cosa emerge dai dati</h3>{(aiReport.strengths||[]).length?(aiReport.strengths||[]).map((x:string,i:number)=><div className="ai-bullet" key={i}><i className="good-dot"/><p>{x}</p></div>):<p className="ai-muted">Non ci sono ancora elementi sufficienti per identificare punti di forza specifici.</p>}</section><section className="panel ai-result-card"><span className="eyebrow">03 · DA MONITORARE</span><h3>Attenzione e verifiche</h3>{(aiReport.attention||[]).map((x:string,i:number)=><div className="ai-bullet" key={i}><i className="warn-dot"/><p>{x}</p></div>)}</section></div>}
 {aiReport.mode==="rules"&&aiReport.suggestions?.length>0&&<section className="panel ai-result-card"><span className="eyebrow">04 · PROSSIMI PASSI</span><h3>Controlli suggeriti</h3><div className="ai-next-steps">{aiReport.suggestions.map((x:string,i:number)=><div key={i}><b>0{i+1}</b><span>{x}</span></div>)}</div></section>}
 <p className="ai-disclaimer">{aiReport.disclaimer}</p></>}
 {aiStatus==="loading"&&<section className="panel ai-loading"><span className="ai-loading-orbit"><Sparkles size={22}/></span><h3>Sto analizzando il tuo portafoglio</h3><p>Elaboro i movimenti, verifico i dati disponibili e preparo il report AI.</p></section>}
 {!aiReport&&aiStatus!=="loading"&&<section className="panel ai-empty"><Sparkles size={27}/><h3>La tua analisi è pronta quando vuoi</h3><p>Avvia l'analisi per ricevere una lettura dei dati effettivamente disponibili nel tuo account.</p></section>}
</div>}
{section==="Analisi"&&<div className="analysis-layout"><section className="panel section"><div className="panelhead"><div><div className="eyebrow">ANALISI · PORTAFOGLIO</div><h2>La composizione dei tuoi investimenti</h2><p>Distribuzione del valore registrato per singolo ETF.</p></div><span className="tag">{funds.length} STRUMENTI</span></div>{analysisRows.length===0?<p className="empty-state">Registra un acquisto per visualizzare composizione e concentrazione del portafoglio.</p>:<div className="analysis-chart-grid"><div className="analysis-donut"><ResponsiveContainer width="100%" height={250}><PieChart><Pie data={analysisRows} dataKey="value" nameKey="name" innerRadius={68} outerRadius={96} paddingAngle={3} stroke="none">{analysisRows.map((entry,index)=><Cell key={entry.name} fill={analysisPalette[index%analysisPalette.length]}/>)}</Pie><Tooltip formatter={(value)=>money(Number(value))} contentStyle={{background:"#28292e",border:"1px solid #ffffff25",borderRadius:10,color:"#fff"}}/></PieChart></ResponsiveContainer><div className="analysis-donut-center"><b>{money(total)}</b><small>Valore registrato</small></div></div><div className="analysis-legend">{analysisRows.map((p,index)=><div className="analysis-legend-row" key={p.name}><i style={{background:analysisPalette[index%analysisPalette.length]}}/><span>{p.name}</span><b>{p.weight.toLocaleString("it-IT",{maximumFractionDigits:1})}%</b></div>)}</div></div>}</section><div className="analysis-kpis"><section className="panel kpi"><div className="kpitop"><span>Strumenti in portafoglio</span><i><ChartNoAxesCombined size={17}/></i></div><b>{funds.length}</b><small>ETF con posizione attiva</small></section><section className="panel kpi"><div className="kpitop"><span>Risultato registrato</span><i><ChartNoAxesCombined size={17}/></i></div><b className={profit>=0?"positive":"negative"}>{fmt(profit)}</b><small>{portfolioReturn.toLocaleString("it-IT",{minimumFractionDigits:2,maximumFractionDigits:2})}% sul capitale registrato</small></section><section className="panel kpi"><div className="kpitop"><span>Peso maggiore</span><i><ChartNoAxesCombined size={17}/></i></div><b>{topWeight.toLocaleString("it-IT",{maximumFractionDigits:1})}%</b><small>{analysisRows[0]?.name||"Nessuna posizione"}</small></section></div><section className="panel section"><div className="panelhead"><div><h2>Confronto tra posizioni</h2><p>Valore calcolato con quantità e ultimo prezzo registrato.</p></div></div>{analysisRows.length===0?<p className="empty-state">Nessun dato disponibile.</p>:<div className="analysis-bars"><ResponsiveContainer width="100%" height={Math.max(230,analysisRows.length*58)}><BarChart data={analysisRows} layout="vertical" margin={{top:4,right:18,bottom:4,left:8}}><CartesianGrid stroke="#ffffff12" horizontal={false}/><XAxis type="number" tickFormatter={(v)=>money(Number(v))} stroke="#85868e" tickLine={false} axisLine={false}/><YAxis type="category" dataKey="name" width={64} stroke="#c4c5cc" tickLine={false} axisLine={false}/><Tooltip formatter={(value)=>money(Number(value))} contentStyle={{background:"#28292e",border:"1px solid #ffffff25",borderRadius:10,color:"#fff"}}/><Bar dataKey="value" name="Valore" radius={[0,8,8,0]}>{analysisRows.map((entry,index)=><Cell key={entry.name} fill={analysisPalette[index%analysisPalette.length]}/>)}</Bar></BarChart></ResponsiveContainer></div>}</section><section className="panel section"><div className="panelhead"><div><h2>Dettaglio delle posizioni</h2><p>Valore, capitale registrato e risultato per ETF.</p></div></div>{analysisRows.length===0?<p className="empty-state">Nessuna posizione da analizzare.</p>:analysisRows.map(p=><div className="analysis-position" key={p.name}><div><b>{p.name}</b><small>{p.weight.toLocaleString("it-IT",{maximumFractionDigits:1})}% del portafoglio</small></div><div><b>{money(p.value)}</b><small>Investito {money(p.invested)}</small></div><strong className={p.pnl>=0?"positive":"negative"}>{p.pnl>=0?"+":""}{money(p.pnl)}</strong></div>)}</section><p className="muted analysis-disclaimer">Nota: questi grafici descrivono i dati registrati nel tuo account. Il valore usa l'ultimo prezzo inserito nelle operazioni, non una quotazione di mercato in tempo reale. La concentrazione per ETF non misura da sola la diversificazione sottostante, l'esposizione geografica o la sovrapposizione dei titoli.</p></div>}
{section==="Transazioni"&&<section className="panel section"><div className="panelhead"><div><h2>Registro movimenti</h2><p>Operazioni demo salvate in questo browser</p></div><button className="primary" onClick={()=>D(true)}><Plus/> Nuovo movimento</button></div>{tx.length===0?<p>Nessun movimento registrato.</p>:tx.map(t=><div className="explorerow" key={t.id}><ArrowUpRight/><div className="fund"><b>Acquisto · {t.ticker}</b><small>{t.date} · {t.qty} quote · commissione {money(t.fee)}</small></div><strong>{money(t.qty*t.price+t.fee)}</strong></div>)}</section>}
<footer>IL MIO PERCORSO ETF <i/> GLASS DASHBOARD V30 <span>· {userEmail?"Account cloud sincronizzato":"Modalità demo"} · Nessun ordine reale</span></footer></div></section>
{authOpen&&<div className="backdrop" onClick={()=>AuthOpen(false)}><section className="modal panel" onClick={e=>e.stopPropagation()}><div className="panelhead"><div><div className="eyebrow">ACCOUNT · SUPABASE</div><h2>{userEmail?"Account collegato":"Accedi alla community"}</h2></div><button className="icon" onClick={()=>AuthOpen(false)}><X/></button></div>{userEmail?<><p className="muted">Accesso effettuato con {userEmail}. I dati cloud personali sono protetti da Row Level Security.</p><button className="secondary" onClick={async()=>{const sb=getSupabaseBrowserClient();if(sb)await sb.auth.signOut();AuthOpen(false);B("Disconnessione completata");}}>Esci dall’account</button></>:<><p className="muted">Accedi o crea un account per preparare la sincronizzazione del portafoglio. Le credenziali vengono gestite da Supabase.</p><div className="auth-switch"><button className={authMode==="login"?"selected":""} onClick={()=>AuthMode("login")}>Accedi</button><button className={authMode==="signup"?"selected":""} onClick={()=>AuthMode("signup")}>Crea account</button></div><label>Email<input type="email" autoComplete="email" value={email} onChange={e=>Email(e.target.value)} placeholder="nome@email.com"/></label><label>Password<input type="password" autoComplete={authMode==="login"?"current-password":"new-password"} value={password} onChange={e=>Password(e.target.value)} placeholder="Almeno 8 caratteri"/></label><button className="primary auth-submit" disabled={authBusy||!email||password.length<8} onClick={async()=>{const sb=getSupabaseBrowserClient();if(!sb){B("Configura prima URL e chiave pubblica Supabase in Vercel");return;}AuthBusy(true);const result=authMode==="login"?await sb.auth.signInWithPassword({email,password}):await sb.auth.signUp({email,password});AuthBusy(false);if(result.error){B(result.error.message);}else if(authMode==="signup"&&!result.data.session){B("Account creato: controlla la tua email per confermare l’indirizzo.");}else{B("Accesso effettuato");AuthOpen(false);}setTimeout(()=>B(""),4500);}}>{authBusy?"Attendere…":authMode==="login"?"Accedi":"Crea account"}</button></>}</section></div>}{newEtfOpen&&<div className="backdrop" onClick={()=>NewEtfOpen(false)}><section className="modal panel" onClick={e=>e.stopPropagation()}><div className="panelhead"><div><div className="eyebrow">CATALOGO PERSONALE</div><h2>Aggiungi un ETF</h2></div><button className="icon" onClick={()=>NewEtfOpen(false)}><X/></button></div><p className="muted">Cerca prima l’ISIN nel catalogo condiviso. Se è presente, ticker, nome ed emittente vengono compilati automaticamente.</p><label>ISIN<input value={newIsin} maxLength={12} onChange={e=>{NewIsin(e.target.value.toUpperCase().replace(/\\s/g,""));IsinSearchMessage("");}} placeholder="Es. IE00BFMXXD54"/></label><button className="secondary" disabled={isinSearchBusy||!newIsin.trim()} onClick={searchEtfByIsin}>{isinSearchBusy?"Ricerca in corso…":"Cerca tramite ISIN"}</button>{isinSearchMessage&&<p className="muted">{isinSearchMessage}</p>}<label>Ticker<input value={newTicker} onChange={e=>NewTicker(e.target.value.toUpperCase())} placeholder="Compilato dalla ricerca o inserito manualmente"/></label><label>Nome ETF<input value={newName} onChange={e=>NewName(e.target.value)} placeholder="Nome completo dello strumento"/></label><label>Emittente (facoltativo)<input value={newIssuer} onChange={e=>NewIssuer(e.target.value)} placeholder="Es. Vanguard"/></label><div className="modalactions"><button className="secondary" onClick={()=>NewEtfOpen(false)}>Annulla</button><button className="primary" disabled={!newIsin.trim()||!newTicker.trim()||!newName.trim()} onClick={addEtf}>Salva ETF</button></div></section></div>}{modal&&<div className="backdrop" onClick={()=>D(false)}><section className="modal panel" onClick={e=>e.stopPropagation()}><div className="panelhead"><div><div className="eyebrow">PORTAFOGLIO · DEMO</div><h2>Registra un acquisto</h2></div><button className="icon" onClick={()=>D(false)}><X/></button></div><p className="muted">L'operazione viene salvata nel browser e, se hai collegato Supabase, anche nel tuo account. Nessun ordine viene inviato al broker.</p><label>ISIN dell’ETF<input value={purchaseIsin} maxLength={12} onChange={e=>{PurchaseIsin(e.target.value.toUpperCase().replace(/\\s/g,""));K("");PurchaseSearchMessage("");}} placeholder="Es. IE00BFMXXD54"/></label><button className="secondary" disabled={purchaseSearchBusy||!purchaseIsin.trim()} onClick={searchPurchaseIsin}>{purchaseSearchBusy?"Ricerca in corso…":"Cerca ETF tramite ISIN"}</button>{purchaseSearchMessage&&<p className="muted">{purchaseSearchMessage}</p>}{ticker&&<p className="muted">ETF selezionato: <b>{ticker}</b></p>}<div className="formgrid"><label>Quantità<input type="number" min="0" step="any" value={qty} onChange={e=>Y(e.target.value)}/></label><label>Prezzo quota (€)<input type="number" min="0" step="any" value={price} onChange={e=>Z(e.target.value)}/></label></div><label>Commissione (€)<input type="number" min="0" step="any" value={fee} onChange={e=>E(e.target.value)}/></label><div className="totalrow">Totale con commissione <b>{money((+qty||0)*(+price||0)+(+fee||0))}</b></div><div className="modalactions"><button className="secondary" onClick={()=>D(false)}>Annulla</button><button className="primary" disabled={!ticker||!purchaseIsin.trim()} onClick={save}>Salva operazione</button></div></section></div>}{adjustingFund&&<div className="backdrop" onClick={()=>AdjustingFund(null)}><section className="modal panel" onClick={e=>e.stopPropagation()}><div className="panelhead"><div><div className="eyebrow">PORTAFOGLIO · MODIFICA POSIZIONE</div><h2>{adjustingFund.ticker}</h2></div><button className="icon" onClick={()=>AdjustingFund(null)}><X/></button></div><p className="muted">Inserisci il numero totale di quote che possiedi oggi. La piattaforma registrerà una rettifica di acquisto o vendita, mantenendo lo storico precedente.</p><label>Quantità attuale desiderata<input type="number" min="0" step="any" value={adjustQuantity} onChange={e=>AdjustQuantity(e.target.value)}/></label><div className="totalrow">Quantità attuale registrata <b>{adjustingFund.qty.toLocaleString("it-IT",{maximumFractionDigits:8})}</b></div><div className="modalactions"><button className="secondary" onClick={()=>AdjustingFund(null)}>Annulla</button><button className="secondary" disabled={adjustBusy} onClick={()=>{if(confirm("Eliminare "+adjustingFund.ticker+" dal tuo portafoglio? Verrà registrata una vendita di tutte le quote; lo storico resterà conservato.")){void savePositionAdjustment(0);}}}>Elimina ETF</button><button className="primary" disabled={adjustBusy||!adjustQuantity.trim()} onClick={()=>void savePositionAdjustment()}>{adjustBusy?"Salvataggio…":"Salva quantità"}</button></div></section></div>}{toast&&<div className="toast">✓ {toast}</div>}</main>}
function AnimatedNumber({value,format}:{value:number,format:(n:number)=>string}){const [shown,Shown]=useState(0);useEffect(()=>{let frame=0;const start=performance.now(),duration=1100;const tick=(now:number)=>{const t=Math.min(1,(now-start)/duration);Shown(value*(1-Math.pow(1-t,3)));if(t<1)frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);},[value]);return <>{format(shown)}</>}
function Kpi({label,value,note,format}:{label:string,value:number,note:string,format:(n:number)=>string}){const [shown,Shown]=useState(0);useEffect(()=>{let frame=0;const start=performance.now(),duration=1100;const tick=(now:number)=>{const t=Math.min(1,(now-start)/duration);Shown(value*(1-Math.pow(1-t,3)));if(t<1)frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);},[value]);return <section className="panel kpi"><div className="kpitop"><span>{label}</span><i><ChartNoAxesCombined size={17}/></i></div><b>{format(shown)}</b><small>{note}</small></section>}
function FundTable({rows,hidden}:{rows:Fund[],hidden:boolean}){return <div className="tablewrap"><table><thead><tr><th>STRUMENTO</th><th>QUOTE</th><th>PREZZO</th><th>VALORE</th><th>VARIAZIONE</th></tr></thead><tbody>{rows.length===0?<tr><td colSpan={5} className="empty-cell">Nessun ETF nel portafoglio. Registra il tuo primo acquisto.</td></tr>:rows.map(p=>{const pnl=(p.price-p.avg)*p.qty;return <tr key={p.ticker}><td><b>{p.ticker}</b><small className="subfund">{p.name}</small></td><td>{p.qty}</td><td>{money(p.price)}</td><td><b>{hidden?"••••••":money(p.qty*p.price)}</b></td><td className={pnl>=0?"positive":"negative"}>{pnl>=0?"+":""}{hidden?"••":money(pnl)}</td></tr>})}</tbody></table></div>}
