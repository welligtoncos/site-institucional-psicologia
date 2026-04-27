import Link from "next/link";
import Image from "next/image";
import { navItems, siteConfig } from "../lib/site";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto w-full max-w-6xl px-5 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center">
            <Image
              src={siteConfig.logoDark}
              alt={siteConfig.fullName}
              width={228}
              height={44}
              priority
              className="h-9 w-auto sm:h-10"
            />
          </Link>

          <nav className="hidden items-center gap-2 md:flex">
            {navItems
              .filter((item) => item.href !== "/")
              .map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  {item.label}
                </Link>
              ))}
          </nav>

          <Link
            href="/login?next=/portal"
            className="rounded-full bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-[#2563EB]/25 transition hover:bg-[#1E4FD6]"
          >
            Agendar
          </Link>
        </div>

        <nav className="mt-4 flex gap-2 overflow-x-auto pb-1 md:hidden">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
