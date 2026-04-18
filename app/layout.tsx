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
    default: `${siteConfig.fullName}`,
    template: `%s | ${siteConfig.name}`,
  },
  description:
    "Clinica de psicologia com atendimento humanizado, presencial e online, focado em acolhimento, confianca e desenvolvimento emocional.",
  keywords: [
    "clinica de psicologia",
    "psicologa",
    "terapia",
    "saude mental",
    "terapia online",
    "terapia de casal",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: siteConfig.fullName,
    description:
      "Atendimento psicologico profissional para adolescentes, adultos e casais, com cuidado acolhedor e etico.",
    type: "website",
    url: "/",
    locale: "pt_BR",
    siteName: siteConfig.name,
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.fullName,
    description:
      "Cuidado emocional com escuta qualificada, etica profissional e plano terapeutico personalizado.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-slate-50 text-slate-800">
        <AppShell>{children}</AppShell>
        <ToasterProvider />
      </body>
    </html>
  );
}
