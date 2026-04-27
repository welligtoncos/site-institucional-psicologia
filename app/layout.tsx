import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { AppShell } from "./components/AppShell";
import { siteConfig } from "./lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
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
    images: [
      {
        url: siteConfig.defaultOgImage,
        width: 1200,
        height: 630,
        alt: "Psicologo Online Ja",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Psicologo Online Ja",
    description:
      "Terapia online com atendimento humanizado e agendamento rapido.",
    images: [siteConfig.defaultOgImage],
  },
  other: {
    googlebot: "notranslate",
    google: "nopagereadaloud",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
      addressLocality: siteConfig.city,
      postalCode: siteConfig.postalCode,
      addressCountry: siteConfig.countryCode,
    },
    image: `${siteConfig.siteUrl}${siteConfig.defaultOgImage}`,
    priceRange: siteConfig.priceRange,
    areaServed: "Brasil",
    serviceType: ["Psicologia", "Terapia Online", "Terapia de Casal"],
  };

  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-slate-50 text-slate-800">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
        />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
