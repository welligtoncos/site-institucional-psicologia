"use client";

import { usePathname, useRouter } from "next/navigation";

import { clearPortalPatientSnapshot } from "@/app/lib/portal-patient-snapshot";

const ACCESS_TOKEN_KEY = "portal_access_token";
const REFRESH_TOKEN_KEY = "portal_refresh_token";

function buildPortalLoginUrl(pathname: string | null): string {
  const nextPath = pathname && pathname.startsWith("/portal") ? pathname : "/portal";
  return `/login?next=${encodeURIComponent(nextPath)}`;
}

export function PortalLogoutButton() {
  const router = useRouter();
  const pathname = usePathname();

  function handleLogout() {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    clearPortalPatientSnapshot();
    router.push(buildPortalLoginUrl(pathname));
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
    >
      Sair do portal
    </button>
  );
}
