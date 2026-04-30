import type { Metadata } from "next";
import { AdminLogoutButton } from "@/app/components/admin/AdminLogoutButton";
import { AdminPortalNav } from "@/app/components/admin/AdminPortalNav";
import { siteConfig } from "@/app/lib/site";

export const metadata: Metadata = {
  title: { default: "Administração", template: `%s · Admin · ${siteConfig.name}` },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50/80 via-white to-slate-50">
      <header className="border-b border-indigo-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-800">{siteConfig.name}</p>
            <p className="text-sm font-semibold text-slate-900">Portal administrativo</p>
          </div>
          <AdminLogoutButton />
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-4 sm:gap-6 sm:px-6 sm:py-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:px-8">
        <aside className="hidden lg:block">
          <AdminPortalNav />
        </aside>
        <div className="lg:hidden">
          <AdminPortalNav />
        </div>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
