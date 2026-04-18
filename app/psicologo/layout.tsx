import Link from "next/link";

import { PsicologoNav } from "@/app/psicologo/PsicologoNav";
import { siteConfig } from "@/app/lib/site";

type LayoutProps = {
  children: React.ReactNode;
};

export default function PsicologoLayout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/80 via-white to-slate-50">
      <header className="border-b border-emerald-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800">{siteConfig.name}</p>
            <p className="text-sm font-semibold text-slate-900">Área do psicólogo</p>
          </div>
          <Link
            href="/"
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Site institucional
          </Link>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl gap-6 px-5 py-6 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:px-8">
        <aside className="h-fit rounded-2xl border border-emerald-100/80 bg-white p-4 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Menu</p>
          <PsicologoNav />
          <Link
            href="/portal"
            className="mt-4 block rounded-xl border border-slate-100 px-3 py-2 text-xs text-slate-500 transition hover:bg-slate-50"
          >
            ← Portal do paciente (se aplicável)
          </Link>
        </aside>

        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
