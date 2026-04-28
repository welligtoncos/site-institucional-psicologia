import Link from "next/link";
import type { Metadata } from "next";

import { PortalBottomNav } from "@/app/components/portal/PortalBottomNav";
import { PortalLogoutButton } from "@/app/components/portal/PortalLogoutButton";
import { PortalNav } from "@/app/components/portal/PortalNav";
import { siteConfig } from "@/app/lib/site";

type PortalLayoutProps = {
  children: React.ReactNode;
};

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function PortalLayout({ children }: PortalLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-slate-50 to-white">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-700">Portal do paciente</p>
          <PortalLogoutButton />
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-4 sm:gap-6 sm:px-6 sm:py-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:px-8">
        <aside className="hidden h-fit rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4 lg:sticky lg:top-6 lg:block">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 sm:mb-3 sm:text-xs sm:tracking-[0.2em]">
            Menu
          </p>
          <PortalNav />
        </aside>

        <main className="min-w-0 pb-[calc(5.75rem+env(safe-area-inset-bottom))] lg:pb-0">{children}</main>
      </div>
      <PortalBottomNav />

      <footer className="mt-4 hidden border-t border-slate-200 bg-white/80 lg:block">
        <div className="mx-auto max-w-6xl px-5 py-8 sm:px-6 lg:px-8">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Suporte</p>
              <p className="mt-2 text-sm text-slate-600">
                Fale com a recepção da <span className="font-medium text-slate-800">{siteConfig.fullName}</span> em horário comercial.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contato</p>
              <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
                <li>
                  <a
                    href={`tel:+55${siteConfig.phoneDisplay.replace(/\D/g, "")}`}
                    className="underline hover:text-sky-800"
                  >
                    {siteConfig.phoneDisplay}
                  </a>
                </li>
                <li>
                  <a href={`mailto:${siteConfig.email}`} className="underline hover:text-sky-800">
                    {siteConfig.email}
                  </a>
                </li>
                <li>
                  <a
                    href={siteConfig.whatsappHref}
                    rel="nofollow"
                    className="font-medium text-emerald-800 underline hover:text-emerald-950"
                  >
                    WhatsApp
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ajuda rápida</p>
              <ul className="mt-2 space-y-1.5 text-sm">
                <li>
                  <Link href="/portal" className="text-sky-800 underline hover:text-sky-950">
                    Início do portal
                  </Link>
                </li>
                <li>
                  <a href={`mailto:${siteConfig.email}`} className="text-sky-800 underline hover:text-sky-950">
                    Dúvidas frequentes / contato
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Privacidade</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Tratamos seus dados com sigilo.{" "}
                <a href={`mailto:${siteConfig.email}`} className="font-semibold text-sky-800 underline hover:text-sky-950">
                  Política e LGPD
                </a>{" "}
                — solicite pelo canal oficial da clínica.
              </p>
            </div>
          </div>
          <p className="mt-8 border-t border-slate-100 pt-6 text-center text-xs text-slate-500">
            {siteConfig.address} · {siteConfig.businessHours}
          </p>
        </div>
      </footer>
    </div>
  );
}
