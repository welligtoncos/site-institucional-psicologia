"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const ACCESS_TOKEN_KEY = "portal_access_token";
const REFRESH_TOKEN_KEY = "portal_refresh_token";

type MeResponse = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  is_active: boolean;
  created_at: string;
  detail?: string;
};

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  detail?: string;
};

export function PortalGate() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    async function fetchMeWithToken(accessToken: string) {
      const response = await fetch("/api/portal/me", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const data = (await response.json()) as MeResponse;
      return { response, data };
    }

    async function refreshSession(refreshToken: string) {
      const response = await fetch("/api/portal/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      const data = (await response.json()) as TokenResponse;
      return { response, data };
    }

    async function validateSession() {
      const accessToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
      const refreshToken = window.localStorage.getItem(REFRESH_TOKEN_KEY);

      if (!accessToken) {
        router.push("/login?next=/portal");
        return;
      }

      const meAttempt = await fetchMeWithToken(accessToken);
      if (meAttempt.response.ok) {
        if (!mounted) return;
        setUserName(meAttempt.data.name);
        setLoading(false);
        return;
      }

      if (!refreshToken) {
        window.localStorage.removeItem(ACCESS_TOKEN_KEY);
        router.push("/login?next=/portal");
        return;
      }

      const refreshAttempt = await refreshSession(refreshToken);
      if (
        !refreshAttempt.response.ok ||
        !refreshAttempt.data.access_token ||
        !refreshAttempt.data.refresh_token
      ) {
        window.localStorage.removeItem(ACCESS_TOKEN_KEY);
        window.localStorage.removeItem(REFRESH_TOKEN_KEY);
        router.push("/login?next=/portal");
        return;
      }

      window.localStorage.setItem(ACCESS_TOKEN_KEY, refreshAttempt.data.access_token);
      window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshAttempt.data.refresh_token);

      const retriedMe = await fetchMeWithToken(refreshAttempt.data.access_token);
      if (!retriedMe.response.ok) {
        if (!mounted) return;
        setErrorMessage(retriedMe.data.detail || "Nao foi possivel validar a sessao.");
        setLoading(false);
        return;
      }

      if (!mounted) return;
      setUserName(retriedMe.data.name);
      setLoading(false);
    }

    validateSession().catch((error) => {
      if (!mounted) return;
      setErrorMessage(error instanceof Error ? error.message : "Erro ao carregar portal.");
      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [router]);

  function handleLogout() {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    router.push("/login");
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <p className="text-sm text-slate-600">Validando sessao...</p>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
        <p className="text-sm text-rose-700">{errorMessage}</p>
        <Link
          href="/login"
          className="inline-flex rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
        >
          Voltar para login
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm text-slate-600">Autenticado como {userName}.</p>
      <h1 className="text-3xl font-semibold text-slate-900">Hello world</h1>
      <p className="text-sm text-slate-600">
        Portal interno conectado na autenticacao do projeto principal `app_backend`.
      </p>
      <button
        type="button"
        onClick={handleLogout}
        className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
      >
        Sair
      </button>
    </div>
  );
}
