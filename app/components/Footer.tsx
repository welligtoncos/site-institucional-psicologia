import Link from "next/link";
import { navItems, siteConfig } from "../lib/site";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-200/80 bg-white py-10 text-slate-600">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 sm:px-6 md:grid-cols-3 lg:px-8">
        <div>
          <p className="text-base font-semibold text-slate-800">{siteConfig.fullName}</p>
          <p className="mt-3 text-sm leading-relaxed">
            Atendimento psicologico humanizado para adolescentes, adultos e casais, com foco em
            saude emocional e qualidade de vida.
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-700">Navegacao</p>
          <nav className="mt-3 flex flex-col gap-2 text-sm">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="transition hover:text-slate-900">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-700">Contato</p>
          <div className="mt-3 space-y-2 text-sm">
            <p>{siteConfig.address}</p>
            <p>{siteConfig.phoneDisplay}</p>
            <p>{siteConfig.email}</p>
            <p>{siteConfig.businessHours}</p>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-8 w-full max-w-6xl border-t border-slate-200 px-5 pt-5 text-xs text-slate-500 sm:px-6 lg:px-8">
        <p>(c) 2026 Clinica Harmonia. Todos os direitos reservados.</p>
      </div>
    </footer>
  );
}
