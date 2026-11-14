import type { NextConfig } from "next";

const config: NextConfig = {
  // PDFKit deve restare esterno al bundle Node per risolvere i font
  // relativi al proprio package durante la generazione del PDF.
  serverExternalPackages: ["pdfkit"],

  // I font vengono caricati dinamicamente da PDFKit: il tracer di Vercel
  // non sempre li include automaticamente nella funzione serverless.
  outputFileTracingIncludes: {
    "/api/ai-analysis/pdf": [
      "./node_modules/pdfkit/js/standard-fonts/**/*",
      "./node_modules/pdfkit/js/data/**/*"
    ]
  }
};

export default config;
