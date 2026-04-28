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

/** Espelha `PsicologoNav` — rolagem horizontal no telefone para caber os 7 destinos sem esconder rotas. */
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
    href: "/psicologo/disponibilidade",
    label: "Agenda livre",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v6l4 2" />
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
    href: "/psicologo/pacientes",
    label: "Pacientes",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
        <circle cx="9" cy="8" r="2.8" />
        <circle cx="16" cy="9" r="2.2" />
        <path d="M4.5 20c.4-3.1 2.9-5.2 6-5.2 1.2 0 2.3.3 3.3.8M16.5 14.2c2.6.9 4.5 3.3 4.9 6.2" />
      </svg>
    ),
  },
  {
    href: "/psicologo/faturas",
    label: "Consultas",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
        <path d="M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z" />
        <path d="M9 12h6M9 16h6" />
      </svg>
    ),
  },
];

export function PsicologoBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Menu principal do psicólogo"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-emerald-100 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85 lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto scroll-pl-3 scroll-pr-3 touch-pan-x pt-0.5">
        {items.map((item) => {
          const active = isActivePath(pathname, item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-[4.55rem] shrink-0 snap-center flex-col items-center justify-center gap-0.5 px-2 pb-2.5 pt-2 text-[10px] font-semibold leading-tight tracking-tight transition active:opacity-75 min-[400px]:min-w-[5rem] min-[400px]:text-[11px] ${
                active ? "text-emerald-800" : "text-slate-500"
              }`}
            >
              <span className={active ? "text-emerald-600" : undefined}>{item.icon}</span>
              <span className="line-clamp-2 text-center">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
