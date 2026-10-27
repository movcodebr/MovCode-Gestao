import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components desligado: todas as telas mostram dados financeiros do
  // usuário logado e precisam estar sempre atualizadas (renderização dinâmica).
  cacheComponents: false,
  // Bibliotecas de exportação leem arquivos próprios (fontes) em tempo de execução
  serverExternalPackages: ["pdfmake", "exceljs"],
  // Restaurar backup enviando o arquivo (.json.gz): até 4 MB (limite da Vercel é 4,5 MB)
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  // Cabeçalhos de segurança em todas as respostas
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Impede que o sistema seja aberto dentro de outro site (clickjacking)
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
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
