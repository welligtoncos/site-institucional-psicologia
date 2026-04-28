import Link from "next/link";

import { navItems, siteConfig } from "../lib/site";

export function Header() {
  const desktopLinks = navItems.filter((item) => item.href !== "/");

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/90 bg-white/95 shadow-sm shadow-slate-900/5 backdrop-blur-md supports-[backdrop-filter]:bg-white/90">
      <div className="mx-auto w-full max-w-6xl px-4 py-3 sm:px-6 lg:px-8" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/"
            className="min-h-[44px] min-w-0 shrink text-left text-base font-semibold tracking-tight text-slate-800 sm:text-lg"
          >
            <span className="line-clamp-2">{siteConfig.name}</span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex lg:gap-2" aria-label="Principal">
            {desktopLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 xl:px-4"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login?next=/portal"
              className="hidden min-h-[44px] items-center rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 sm:inline-flex"
            >
              Entrar
            </Link>
            <Link
              href="/login?next=/portal&focus=email"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-sky-600 px-4 text-sm font-semibold text-white shadow-md shadow-sky-600/20 transition hover:bg-sky-700"
            >
              Agendar
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
