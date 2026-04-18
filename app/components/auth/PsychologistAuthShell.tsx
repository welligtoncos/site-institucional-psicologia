"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const ACCESS_TOKEN_KEY = "portal_access_token";
const REFRESH_TOKEN_KEY = "portal_refresh_token";

export const PSYCHOLOGIST_LOGIN_NEXT = "/login?next=/psicologo";

type MeResponse = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: "patient" | "psychologist" | "admin";
  is_active: boolean;
  terms_accepted_at?: string | null;
  created_at: string;
  detail?: string;
};

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  detail?: string;
};

export type PsychologistSessionUser = {
  name: string;
  email: string;
};

const SessionContext = createContext<PsychologistSessionUser | null>(null);

export function usePsychologistSession(): PsychologistSessionUser {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("usePsychologistSession deve ser usado dentro de PsychologistAuthShell.");
  }
  return ctx;
}

function roleMayUsePsychPortal(role: string): boolean {
  return role === "psychologist" || role === "admin";
}

type PsychologistAuthShellProps = {
  children: ReactNode;
};

/**
 * Valida JWT e perfil (psicólogo ou admin). Paciente é redirecionado ao portal do paciente.
 */
export function PsychologistAuthShell({ children }: PsychologistAuthShellProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<PsychologistSessionUser | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    async function fetchMeWithToken(accessToken: string) {
      const response = await fetch("/api/portal/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
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
        router.push(PSYCHOLOGIST_LOGIN_NEXT);
        return;
      }

      const meAttempt = await fetchMeWithToken(accessToken);
      if (meAttempt.response.ok) {
        if (meAttempt.data.role === "patient") {
          router.replace("/portal");
          return;
        }
        if (!roleMayUsePsychPortal(meAttempt.data.role)) {
          router.replace("/portal");
          return;
        }
        if (!mounted) return;
        setUser({ name: meAttempt.data.name, email: meAttempt.data.email });
        setLoading(false);
        return;
      }

      if (!refreshToken) {
        window.localStorage.removeItem(ACCESS_TOKEN_KEY);
        router.push(PSYCHOLOGIST_LOGIN_NEXT);
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
        router.push(PSYCHOLOGIST_LOGIN_NEXT);
        return;
      }

      window.localStorage.setItem(ACCESS_TOKEN_KEY, refreshAttempt.data.access_token);
      window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshAttempt.data.refresh_token);

      const retriedMe = await fetchMeWithToken(refreshAttempt.data.access_token);
      if (!retriedMe.response.ok) {
        if (!mounted) return;
        setErrorMessage(
          typeof retriedMe.data.detail === "string" ? retriedMe.data.detail : "Não foi possível validar a sessão.",
        );
        setLoading(false);
        return;
      }

      if (retriedMe.data.role === "patient") {
        router.replace("/portal");
        return;
      }
      if (!roleMayUsePsychPortal(retriedMe.data.role)) {
        router.replace("/portal");
        return;
      }

      if (!mounted) return;
      setUser({ name: retriedMe.data.name, email: retriedMe.data.email });
      setLoading(false);
    }

    validateSession().catch((error) => {
      if (!mounted) return;
      setErrorMessage(error instanceof Error ? error.message : "Erro ao carregar o portal.");
      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [router]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-emerald-100 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-slate-600">Carregando seu espaço profissional…</p>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="space-y-4 rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
        <p className="text-sm text-rose-800">{errorMessage}</p>
        <Link
          href={PSYCHOLOGIST_LOGIN_NEXT}
          className="inline-flex rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          Voltar ao login
        </Link>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}
