"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type NavItem = {
  href: string;
  label: string;
  exact?: boolean;
  icon: ReactNode;
};

function isActivePath(pathname: string, href: string, exact?: boolean): boolean {
  const normalizedPathname = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  const normalizedHref = href.endsWith("/") ? href.slice(0, -1) : href;
  if (exact) return normalizedPathname === normalizedHref;
  return normalizedPathname === normalizedHref || normalizedPathname.startsWith(`${normalizedHref}/`);
}

const items: NavItem[] = [
  {
    href: "/psicologo",
    label: "Painel",
    exact: true,
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M8 8h3v3H8zM13 8h3M13 11h3M8 14h8M8 17h8" />
      </svg>
    ),
  },
  {
    href: "/psicologo/perfil",
    label: "Perfil",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c.6-3.2 3.4-5.5 7-5.5s6.4 2.3 7 5.5" />
      </svg>
    ),
  },
  {
    href: "/psicologo/agenda",
    label: "Agenda",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M8 3v4M16 3v4M3 10h18" />
      </svg>
    ),
  },
  {
    href: "/psicologo/sessao",
    label: "Sessão",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
        <circle cx="12" cy="12" r="9" />
        <path d="m10 9 6 3-6 3V9Z" />
      </svg>
    ),
  },
  {
    href: "/psicologo/faturas",
    label: "Faturas",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
        <rect x="4" y="3.5" width="16" height="17" rx="2" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </svg>
    ),
  },
];

export function PsicologoBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-emerald-100 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85 md:hidden">
      <ul className="mx-auto grid max-w-2xl grid-cols-5">
        {items.map((item) => {
          const active = isActivePath(pathname, item.href, item.exact);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex flex-col items-center justify-center gap-1 px-2 pb-2 pt-2 text-[11px] font-medium transition ${
                  active ? "text-emerald-700" : "text-slate-500"
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
