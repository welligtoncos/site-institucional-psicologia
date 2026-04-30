"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

const ACCESS_TOKEN_KEY = "portal_access_token";
const REFRESH_TOKEN_KEY = "portal_refresh_token";

type MeResponse = {
  role?: string;
  detail?: string;
};

function loginUrlForAdmin(pathname: string | null) {
  const nextPath = pathname && pathname.startsWith("/admin") ? pathname : "/admin/dashboard";
  return `/login?next=${encodeURIComponent(nextPath)}`;
}

export function AdminGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    async function run() {
      const accessToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
      const refreshToken = window.localStorage.getItem(REFRESH_TOKEN_KEY);
      const urlLogin = loginUrlForAdmin(pathname);

      if (!accessToken) {
        router.replace(urlLogin);
        return;
      }

      let token = accessToken;
      let me = await fetch("/api/portal/me", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      let data = (await me.json()) as MeResponse;

      if (!me.ok && refreshToken) {
        const ref = await fetch("/api/portal/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        const refData = (await ref.json()) as { access_token?: string; refresh_token?: string };
        if (ref.ok && refData.access_token && refData.refresh_token) {
          window.localStorage.setItem(ACCESS_TOKEN_KEY, refData.access_token);
          window.localStorage.setItem(REFRESH_TOKEN_KEY, refData.refresh_token);
          token = refData.access_token;
          me = await fetch("/api/portal/me", {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          });
          data = (await me.json()) as MeResponse;
        }
      }

      if (!me.ok) {
        window.localStorage.removeItem(ACCESS_TOKEN_KEY);
        window.localStorage.removeItem(REFRESH_TOKEN_KEY);
        if (mounted) router.replace(urlLogin);
        return;
      }

      if (data.role !== "admin") {
        if (data.role === "psychologist") {
          router.replace("/psicologo");
          return;
        }
        if (data.role === "patient") {
          router.replace("/portal");
          return;
        }
        window.localStorage.removeItem(ACCESS_TOKEN_KEY);
        window.localStorage.removeItem(REFRESH_TOKEN_KEY);
        router.replace(urlLogin);
        return;
      }

      if (!mounted) return;
      setLoading(false);
    }

    run().catch(() => {
      if (!mounted) return;
      setErrorMessage("Não foi possível validar a sessão.");
      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [router, pathname]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
        Validando acesso administrativo…
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="space-y-4 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
        <p>{errorMessage}</p>
        <Link href={loginUrlForAdmin(pathname)} className="font-semibold text-rose-900 underline">
          Ir para login
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
