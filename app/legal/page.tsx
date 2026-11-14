import Link from "next/link";

const sections = [
  { id: "natura", title: "1. Natura e finalità del servizio", body: [
    "Il Mio Percorso ETF è uno strumento digitale destinato al monitoraggio, all'organizzazione e alla rappresentazione informativa di portafogli personali di ETF e di altri strumenti inseriti volontariamente dall'utente.",
    "La piattaforma ha finalità informative, statistiche, didattiche e di monitoraggio personale. Non è una banca, un broker, un intermediario finanziario o un prestatore di servizi di investimento."
  ]},
  { id: "no-consulenza", title: "2. Nessuna consulenza o raccomandazione", body: [
    "I contenuti, gli indicatori, i punteggi, i grafici, le simulazioni e i report automatici non costituiscono consulenza in materia di investimenti, raccomandazioni personalizzate, gestione di portafogli, ricerca in materia di investimenti o invito a compiere operazioni su strumenti finanziari.",
    "La piattaforma non valuta l'adeguatezza o l'appropriatezza degli investimenti rispetto alla situazione finanziaria, agli obiettivi o alla propensione al rischio dell'utente. Nessun contenuto deve essere interpretato come indicazione di acquistare, vendere o mantenere uno specifico strumento.",
    "Le decisioni di investimento sono assunte autonomamente dall'utente. Prima di operare, l'utente dovrebbe consultare la documentazione ufficiale dello strumento (inclusi KID e prospetto) e rivolgersi, se lo ritiene opportuno, a un professionista autorizzato."
  ]},
  { id: "rischi", title: "3. Rischi degli investimenti", body: [
    "Gli investimenti in ETF e in altri strumenti finanziari comportano rischi, inclusa la possibile perdita parziale o totale del capitale investito. Il valore degli strumenti può aumentare o diminuire; possono incidere, tra gli altri, volatilità dei mercati, rischio valutario, tassi d'interesse, liquidità, costi, fiscalità e rischi dell'emittente o dell'indice sottostante.",
    "Le performance passate, le proiezioni e i risultati delle simulazioni non sono garanzia di rendimenti futuri. Le simulazioni dipendono da ipotesi e semplificazioni che possono non verificarsi."
  ]},
  { id: "dati", title: "4. Dati, quotazioni e calcoli", body: [
    "I dati di mercato, le anagrafiche degli ETF, i prezzi, i cambi, le informazioni descrittive e gli altri dati visualizzati possono provenire da fornitori terzi o da fonti pubbliche. Possono essere ritardati, incompleti, non aggiornati o contenere errori.",
    "I valori di portafoglio, i rendimenti, i prezzi medi, le commissioni e gli altri calcoli sono elaborazioni indicative basate sui dati disponibili e sulle informazioni inserite dall'utente. L'utente è tenuto a verificarli con le fonti ufficiali e con i rendiconti del proprio intermediario."
  ]},
  { id: "ai", title: "5. Analisi generate con intelligenza artificiale", body: [
    "Le analisi generate automaticamente hanno carattere esclusivamente informativo e descrittivo. I sistemi di intelligenza artificiale possono produrre contenuti inesatti, incompleti, non aggiornati o fuorvianti.",
    "I report automatici non sostituiscono la verifica indipendente dei dati né il parere di un professionista autorizzato. Non devono essere utilizzati come unica base per decisioni finanziarie."
  ]},
  { id: "responsabilita", title: "6. Disponibilità del servizio e responsabilità", body: [
    "Il servizio è fornito nello stato in cui si trova e secondo la disponibilità tecnica del momento. Possono verificarsi interruzioni, manutenzioni, malfunzionamenti, perdita temporanea di accesso o indisponibilità di servizi e dati di terze parti.",
    "Nei limiti consentiti dalla legge applicabile, il gestore non garantisce che dati, calcoli, contenuti o funzionalità siano sempre esatti, completi, aggiornati o disponibili e non risponde di decisioni o operazioni di investimento assunte dall'utente sulla base delle informazioni visualizzate.",
    "Nulla in questo documento esclude o limita responsabilità che non possono essere escluse o limitate per legge, inclusi i diritti inderogabili riconosciuti ai consumatori e le responsabilità derivanti da dolo o colpa grave, ove applicabili."
  ]},
  { id: "utente", title: "7. Responsabilità dell'utente", body: [
    "L'utente è responsabile delle informazioni che inserisce, della custodia delle proprie credenziali e della verifica dei dati del proprio portafoglio. Deve utilizzare la piattaforma in modo lecito e non tentare di compromettere sicurezza, disponibilità o funzionamento del servizio."
  ]},
  { id: "proprieta", title: "8. Proprietà intellettuale", body: [
    "Salvo diversa indicazione, marchio, interfaccia, grafica, testi e software della piattaforma sono protetti dalle norme applicabili in materia di proprietà intellettuale. L'accesso al servizio non trasferisce all'utente diritti di proprietà sui relativi contenuti o componenti."
  ]},
  { id: "modifiche", title: "9. Modifiche e contatti", body: [
    "Le presenti informazioni possono essere aggiornate per riflettere modifiche del servizio o della normativa. La versione e la data di aggiornamento dovranno essere indicate nella versione pubblicata.",
    "Per richieste o segnalazioni: [INSERIRE INDIRIZZO EMAIL DI CONTATTO]."
  ]}
];

export default function LegalPage() {
  return <main className="legal-page">
    <div className="legal-top"><Link href="/" className="legal-back">← Torna alla piattaforma</Link><span className="legal-version">INFORMAZIONI LEGALI</span></div>
    <header className="legal-hero">
      <span className="legal-kicker">IL MIO PERCORSO ETF</span>
      <h1>Trasparenza, informazione e utilizzo consapevole.</h1>
      <p>Questa pagina descrive la natura informativa del servizio e i limiti delle informazioni visualizzate. Leggila prima di utilizzare la piattaforma.</p>
      <div className="legal-notice"><b>Importante</b><span>Il Mio Percorso ETF è uno strumento di monitoraggio. Non offre consulenza finanziaria e non esegue operazioni di investimento.</span></div>
    </header>
    <nav className="legal-index" aria-label="Indice delle informazioni legali">{sections.map(s=><a key={s.id} href={`#${s.id}`}>{s.title}</a>)}</nav>
    <div className="legal-content">{sections.map(s=><section className="legal-section" id={s.id} key={s.id}><h2>{s.title}</h2>{s.body.map((p,i)=><p key={i}>{p}</p>)}</section>)}</div>
    <section className="legal-section legal-pending">
      <h2>Documenti da completare prima della pubblicazione</h2>
      <p><b>Privacy policy e cookie policy:</b> devono essere completate in base al titolare effettivo del trattamento, ai dati realmente raccolti, ai tempi di conservazione, ai fornitori (ad esempio hosting, autenticazione, database, analytics e servizi AI) e ai cookie/strumenti effettivamente installati. Questa pagina non sostituisce tali informative né raccoglie il consenso ai cookie.</p>
      <p><b>Dati del gestore:</b> inserire denominazione/nome del titolare, sede o indirizzo professionale, recapito email e ogni ulteriore dato identificativo richiesto dalla normativa applicabile.</p>
      <p><b>Revisione legale:</b> il testo è una bozza informativa generale e deve essere verificato da un professionista legale prima dell'apertura al pubblico. Non costituisce una garanzia di esonero da responsabilità.</p>
      <div className="legal-meta"><span>Bozza da verificare</span><span>Ultimo aggiornamento: 14 novembre 2026</span></div>
    </section>
    <footer className="legal-footer"><span>© Il Mio Percorso ETF</span><Link href="/">Torna alla dashboard</Link></footer>
  </main>;
}
