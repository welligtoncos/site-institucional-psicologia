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

/** Mesma ordem lógica do menu lateral (`PortalNav`), otimizada para dedo / polegar. */
const items: NavItem[] = [
  {
    href: "/portal",
    label: "Início",
    exact: true,
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V20h14V9.5" />
      </svg>
    ),
  },
  {
    href: "/portal/consultas",
    label: "Consultas",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M8 3v4M16 3v4M3 10h18" />
      </svg>
    ),
  },
  {
    href: "/portal/faturamento",
    label: "Pagamentos",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
        <rect x="2.5" y="5.5" width="19" height="14" rx="2.5" />
        <path d="M2.5 10.5h19" />
        <path d="M7 15.5h4" />
      </svg>
    ),
  },
  {
    href: "/portal/agendar",
    label: "Agendar",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 8v8M8 12h8" />
      </svg>
    ),
  },
  {
    href: "/portal/perfil",
    label: "Cadastro",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c.6-3.2 3.4-5.5 7-5.5s6.4 2.3 7 5.5" />
      </svg>
    ),
  },
];

export function PortalBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Menu principal do portal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85 lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <ul className="mx-auto grid max-w-3xl grid-cols-5 gap-0">
        {items.map((item) => {
          const active = isActivePath(pathname, item.href, item.exact);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex flex-col items-center justify-center gap-0.5 px-1 pb-2.5 pt-2 text-[10px] font-semibold leading-tight tracking-tight transition active:opacity-75 min-[380px]:text-[11px] ${
                  active ? "text-sky-700" : "text-slate-500"
                }`}
              >
                <span className={active ? "text-sky-600" : undefined}>{item.icon}</span>
                <span className="line-clamp-2 text-center">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
