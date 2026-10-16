import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Digimax Projetos | Fachadas Inteligentes",
  description: "Gerador paramétrico de conceitos de fachadas e muros frontais com inteligência artificial.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preload" as="image" href="/digimax-loading.png" />
        <script src="https://js.puter.com/v2/" defer />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
