import type { NextConfig } from "next";

const config: NextConfig = {
  // PDFKit usa font standard risolti a runtime: evita che il bundler di Next
  // tenti di risolvere gli alias interni (#standard-fonts/*) durante il build.
  serverExternalPackages: ["pdfkit"]
};

export default config;
