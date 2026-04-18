"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/portal", label: "Início", exact: true },
  { href: "/portal/perfil", label: "Meu perfil" },
  { href: "/portal/ofertas", label: "Profissional" },
  { href: "/portal/agendar", label: "Agendar" },
  { href: "/portal/consultas", label: "Consultas" },
  { href: "/portal/faturamento", label: "Faturamento e notas" },
];

function active(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href || pathname === `${href}/`;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PortalNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-1.5">
      {items.map((item) => {
        const isOn = active(pathname, item.href, item.exact);
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
