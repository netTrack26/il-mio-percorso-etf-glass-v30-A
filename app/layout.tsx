import type {Metadata} from "next";
import "./globals.css";
import LegalFooter from "./components/LegalFooter";

export const metadata: Metadata = {
  title: "Il Mio Percorso ETF | Glass Dashboard V30",
  description: "Dashboard privata per il monitoraggio informativo del portafoglio ETF",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      noarchive: true,
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="it"><body>{children}<LegalFooter /></body></html>;
}
