import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components desligado: todas as telas mostram dados financeiros do
  // usuário logado e precisam estar sempre atualizadas (renderização dinâmica).
  cacheComponents: false,
  // Bibliotecas de exportação leem arquivos próprios (fontes) em tempo de execução
  serverExternalPackages: ["pdfmake", "exceljs"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
