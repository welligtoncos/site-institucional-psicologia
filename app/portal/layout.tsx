import Link from "next/link";

type PortalLayoutProps = {
  children: React.ReactNode;
};

export default function PortalLayout({ children }: PortalLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-slate-50 to-white">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-700">Portal do paciente</p>
          <Link
            href="/"
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Voltar para o site
          </Link>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl gap-6 px-5 py-6 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:px-8">
        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Menu</p>
          <nav className="space-y-2">
            <Link
              href="/portal"
              className="block rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-800"
            >
              Dashboard
            </Link>
            <Link
              href="/portal/ofertas"
              className="block rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
            >
              Ofertas de consulta
            </Link>
            <Link
              href="/portal/agendar"
              className="block rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
            >
              Agendar consulta
            </Link>
            <Link
              href="/portal/consultas"
              className="block rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
            >
              Consultas agendadas
            </Link>
            <p className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-500">Diario emocional</p>
            <p className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-500">Mensagens</p>
          </nav>
        </aside>

        <main>{children}</main>
      </div>
    </div>
  );
}
