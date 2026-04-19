"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { clearPortalPatientSnapshot, savePortalPatientSnapshot } from "@/app/lib/portal-patient-snapshot";

const ACCESS_TOKEN_KEY = "portal_access_token";
const REFRESH_TOKEN_KEY = "portal_refresh_token";

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

type PortalGateProps = {
  children?: ReactNode;
};

export type PortalPatientSessionValue = {
  userName: string;
  userEmail: string;
  logout: () => void;
};

export const PortalPatientSessionContext = createContext<PortalPatientSessionValue | null>(null);

export function usePortalPatientSession(): PortalPatientSessionValue {
  const ctx = useContext(PortalPatientSessionContext);
  if (!ctx) {
    throw new Error("usePortalPatientSession deve ser usado dentro de PortalGate autenticado.");
  }
  return ctx;
}

export function PortalGate({ children }: PortalGateProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
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
        if (meAttempt.data.role !== "patient") {
          router.replace("/psicologo");
          return;
        }
        if (!mounted) return;
        setUserName(meAttempt.data.name);
        setUserEmail(meAttempt.data.email);
        savePortalPatientSnapshot({ name: meAttempt.data.name, email: meAttempt.data.email });
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

      if (retriedMe.data.role !== "patient") {
        router.replace("/psicologo");
        return;
      }

      if (!mounted) return;
      setUserName(retriedMe.data.name);
      setUserEmail(retriedMe.data.email);
      savePortalPatientSnapshot({ name: retriedMe.data.name, email: retriedMe.data.email });
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
    clearPortalPatientSnapshot();
    router.push("/login?next=/portal");
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <p className="text-sm text-slate-600">Validando sessao...</p>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="space-y-4 rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
        <p className="text-sm text-rose-700">{errorMessage}</p>
        <Link
          href="/login?next=/portal"
          className="inline-flex rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
        >
          Voltar para login
        </Link>
      </div>
    );
  }

  const sessionValue: PortalPatientSessionValue = {
    userName,
    userEmail,
    logout: handleLogout,
  };

  if (children != null) {
    return (
      <PortalPatientSessionContext.Provider value={sessionValue}>
        {children}
      </PortalPatientSessionContext.Provider>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950">
      <p className="font-medium">Portal sem conteúdo.</p>
      <p className="mt-2 text-amber-900/90">
        A página inicial deve renderizar <code className="rounded bg-amber-100 px-1">PatientPortalDashboard</code> dentro de{" "}
        <code className="rounded bg-amber-100 px-1">PortalGate</code>.
      </p>
    </div>
  );
}
