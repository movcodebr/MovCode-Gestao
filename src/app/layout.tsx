import type { Metadata, Viewport } from "next";
import { Anton, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--fonte-texto",
  subsets: ["latin"],
});

const anton = Anton({
  variable: "--fonte-titulo",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mov Code — Gestão",
  description: "Controle interno da Mov Code",
};

export const viewport: Viewport = {
  themeColor: "#111214",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${anton.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
