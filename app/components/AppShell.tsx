"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { SiteBottomNav } from "./SiteBottomNav";

const ToasterProvider = dynamic(
  () => import("./ToasterProvider").then((module) => module.ToasterProvider),
  { ssr: false }
);

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const isSystemArea = pathname.startsWith("/portal") || pathname.startsWith("/psicologo");

  if (isSystemArea) {
    /* Layouts de portal/psicólogo já definem fundo claro; não herdar texto claro (inputs ficavam ilegíveis). */
    return (
      <div className="min-h-screen text-slate-900">
        {children}
        <ToasterProvider />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 pb-[calc(5.75rem+env(safe-area-inset-bottom))] lg:pb-0">{children}</main>
      <Footer />
      <SiteBottomNav />
    </div>
  );
}
