"use client";

import { usePathname, useRouter } from "next/navigation";

const ACCESS_TOKEN_KEY = "portal_access_token";
const REFRESH_TOKEN_KEY = "portal_refresh_token";

function buildLoginUrl(pathname: string | null): string {
  const nextPath = pathname && pathname.startsWith("/admin") ? pathname : "/admin/dashboard";
  return `/login?next=${encodeURIComponent(nextPath)}`;
}

export function AdminLogoutButton() {
  const router = useRouter();
  const pathname = usePathname();

  function handleLogout() {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    router.push(buildLoginUrl(pathname));
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
    >
      Sair do sistema
    </button>
  );
}
