"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/portal", label: "Início", exact: true },
  { href: "/portal/consultas", label: "Minhas consultas" },
  { href: "/portal/faturamento", label: "Pagamentos" },
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
    <nav className="grid grid-cols-2 gap-1.5 sm:gap-2 lg:grid-cols-1 lg:gap-1.5">
      {items.map((item) => {
        const isOn = isNavActive(pathname, item.href, item.exact);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`block rounded-lg border px-2.5 py-1.5 text-xs font-medium leading-tight transition sm:rounded-xl sm:px-3 sm:py-2 sm:text-sm ${
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
