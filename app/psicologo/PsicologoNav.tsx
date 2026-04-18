"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/psicologo", label: "Painel", exact: true },
  { href: "/psicologo/agenda", label: "Agenda" },
  { href: "/psicologo/pacientes", label: "Pacientes" },
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
    <nav className="space-y-1.5">
      {items.map((item) => {
        const active = isActive(pathname, item.href, item.exact ?? false);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`block rounded-xl border px-3 py-2 text-sm font-medium transition ${
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
