import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "./components/AppShell";
import { ToasterProvider } from "./components/ToasterProvider";
import { siteConfig } from "./lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.siteUrl),
  title: {
    default: "Psicologo Online Ja | Terapia Online com Psicologos",
    template: `%s | Psicologo Online Ja`,
  },
  description:
    "Psicologo online com atendimento para ansiedade, relacionamentos, autoestima e terapia de casal. Agende sua consulta com praticidade e sigilo.",
  keywords: [
    "psicologo online",
    "terapia online",
    "psicoterapia online",
    "psicologo",
    "terapia",
    "ansiedade",
    "terapia de casal",
    "saude mental",
  ],
  category: "health",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    title: "Psicologo Online Ja",
    description:
      "Atendimento psicologico online com psicologos qualificados, escuta acolhedora e agendamento simples.",
    type: "website",
    url: "/",
    locale: "pt_BR",
    siteName: "Psicologo Online Ja",
  },
  twitter: {
    card: "summary_large_image",
    title: "Psicologo Online Ja",
    description:
      "Terapia online com atendimento humanizado e agendamento rapido.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: "Psicologo Online Ja",
    url: siteConfig.siteUrl,
    telephone: siteConfig.phoneDisplay,
    email: siteConfig.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: siteConfig.address,
      addressCountry: "BR",
    },
    areaServed: "Brasil",
    serviceType: ["Psicologia", "Terapia Online", "Terapia de Casal"],
  };

  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-slate-50 text-slate-800">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
        />
        <AppShell>{children}</AppShell>
        <ToasterProvider />
      </body>
    </html>
  );
}
