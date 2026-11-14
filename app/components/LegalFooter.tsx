import Link from "next/link";
export default function LegalFooter(){return <footer className="global-legal-footer"><span>© {new Date().getFullYear()} Il Mio Percorso ETF</span><span className="global-legal-separator">•</span><span>Strumento informativo di monitoraggio, non consulenza finanziaria</span><Link href="/legal">Informazioni legali</Link></footer>}
