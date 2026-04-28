"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { equipeRecentPsychologistAnchor } from "@/app/lib/site";

type Item = {
  href: string;
  label: string;
  exact?: boolean;
  icon: ReactNode;
};

function active(pathname: string, href: string, exact?: boolean): boolean {
  const pathOnly = href.split("#")[0]?.split("?")[0] ?? href;
  const p = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  const norm = pathOnly.endsWith("/") ? pathOnly.slice(0, -1) : pathOnly;
  if (exact) return p === norm;
  return p === norm || p.startsWith(`${norm}/`);
}

const items: Item[] = [
  {
    href: "/",
    label: "Início",
    exact: true,
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V20h14V9.5" />
      </svg>
    ),
  },
  {
    href: "/especialidades",
    label: "Especialidades",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
        <path d="M4 7h7M4 12h12M4 17h9" strokeLinecap="round" />
        <circle cx="17" cy="7" r="2" />
      </svg>
    ),
  },
  {
    href: `/equipe#${equipeRecentPsychologistAnchor}`,
    label: "Equipe",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
        <circle cx="9" cy="8" r="2.8" />
        <circle cx="16" cy="9" r="2.2" />
        <path d="M4.5 20c.4-3.1 2.9-5.2 6-5.2 1.2 0 2.3.3 3.3.8M16.5 14.2c2.6.9 4.5 3.3 4.9 6.2" />
      </svg>
    ),
  },
  {
    href: "/login?next=/portal&focus=email",
    label: "Agendar",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 8v8M8 12h8" />
      </svg>
    ),
  },
];

/** Barra inferior no site institucional — mesmo padrão visual das áreas logadas (mobile / até lg). */
export function SiteBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Atalhos do site"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md supports-[backdrop-filter]:bg-white/90 lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <ul className="mx-auto grid max-w-lg grid-cols-4 gap-0">
        {items.map((item) => {
          const on =
            item.href.includes("/login") || item.href.includes("/register")
              ? pathname === "/login" || pathname === "/register"
              : active(pathname, item.href, item.exact);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex flex-col items-center justify-center gap-0.5 px-1 pb-2.5 pt-2 text-[10px] font-semibold leading-tight transition active:opacity-75 min-[380px]:text-[11px] ${
                  on ? "text-sky-700" : "text-slate-500"
                }`}
              >
                <span className={on ? "text-sky-600" : undefined}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
