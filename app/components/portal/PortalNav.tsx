"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/portal", label: "Início", exact: true },
  { href: "/portal/consultas", label: "Minhas consultas" },
  { href: "/portal/faturamento", label: "Financeiro" },
  { href: "/portal/atendimento", label: "Atendimento online" },
  { href: "/portal/perfil", label: "Meu cadastro" },
  { href: "/portal/agendar", label: "Agendar" },
];

function isNavActive(pathname: string, href: string, exact?: boolean) {
  const pathNorm = href.endsWith("/") ? href.slice(0, -1) : href;
  const pathnameNorm = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;

  if (exact) return pathnameNorm === pathNorm;
  return pathnameNorm === pathNorm || pathnameNorm.startsWith(`${pathNorm}/`);
}

export function PortalNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-1.5">
      {items.map((item) => {
        const isOn = isNavActive(pathname, item.href, item.exact);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`block rounded-xl border px-3 py-2 text-sm font-medium transition ${
              isOn
                ? "border-sky-300 bg-sky-50 text-sky-900"
                : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
