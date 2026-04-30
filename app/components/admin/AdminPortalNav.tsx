"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/psicologos", label: "Psicólogos" },
  { href: "/admin/pacientes", label: "Pacientes" },
  { href: "/admin/consultas", label: "Consultas" },
  { href: "/admin/pagamentos", label: "Pagamentos" },
] as const;

export function AdminPortalNav() {
  const pathname = usePathname();

  return (
    <nav className="h-fit rounded-2xl border border-indigo-100 bg-white p-3 shadow-sm lg:p-4">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Administração</p>
      <ul className="space-y-1">
        {links.map(({ href, label }) => {
          const active = pathname === href || (href !== "/admin/dashboard" && pathname.startsWith(href));
          return (
            <li key={href}>
              <Link
                href={href}
                className={`block rounded-xl px-3 py-2 text-sm font-medium transition ${
                  active ? "bg-indigo-50 text-indigo-900" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
