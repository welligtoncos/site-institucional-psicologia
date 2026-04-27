"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/psicologo", label: "Painel", exact: true },
  { href: "/psicologo/perfil", label: "Perfil" },
  { href: "/psicologo/disponibilidade", label: "Abrir agenda" },
  { href: "/psicologo/agenda", label: "Agenda" },
  { href: "/psicologo/sessao", label: "Iniciar sessão" },
  { href: "/psicologo/pacientes", label: "Pacientes" },
  { href: "/psicologo/faturas", label: "Minhas consultas" },
];

function isActive(pathname: string, href: string, exact: boolean) {
  if (exact) {
    return pathname === href || pathname === `${href}/`;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PsicologoNav() {
  const pathname = usePathname();

  return (
    <nav className="grid grid-cols-2 gap-1.5 sm:gap-2 lg:grid-cols-1 lg:gap-1.5">
      {items.map((item) => {
        const active = isActive(pathname, item.href, item.exact ?? false);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`block rounded-lg border px-2.5 py-1.5 text-xs font-medium leading-tight transition sm:rounded-xl sm:px-3 sm:py-2 sm:text-sm ${
              active
                ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                : "border-transparent text-slate-700 hover:border-emerald-100 hover:bg-emerald-50/80"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
