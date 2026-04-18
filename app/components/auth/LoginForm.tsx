"use client";

import { FormEvent, useEffect, useId, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { formatApiErrorDetail } from "@/app/lib/portal-errors";

const ACCESS_TOKEN_KEY = "portal_access_token";
const REFRESH_TOKEN_KEY = "portal_refresh_token";

type LoginResponse = {
  access_token?: string;
  refresh_token?: string;
  detail?: unknown;
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const successId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [registeredHint, setRegisteredHint] = useState(false);

  useEffect(() => {
    if (searchParams.get("registered") === "1") {
      setRegisteredHint(true);
    }
  }, [searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/portal/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = (await response.json()) as LoginResponse;
      if (!response.ok || !data.access_token || !data.refresh_token) {
        throw new Error(
          formatApiErrorDetail(
            data,
            "Não foi possível entrar. Confira o e-mail e a senha ou tente de novo em instantes.",
          ),
        );
      }

      window.localStorage.setItem(ACCESS_TOKEN_KEY, data.access_token);
      window.localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
      const params = new URLSearchParams(window.location.search);
      const next = params.get("next");

      const meRes = await fetch("/api/portal/me", {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      const meData = (await meRes.json()) as { role?: string };

      if (meRes.ok && (meData.role === "psychologist" || meData.role === "admin")) {
        const dest = next && next.startsWith("/psicologo") ? next : "/psicologo";
        router.push(dest);
        return;
      }

      if (meRes.ok && meData.role === "patient") {
        if (next && next.startsWith("/psicologo")) {
          router.push("/portal");
          return;
        }
        router.push(next || "/portal");
        return;
      }

      router.push(next || "/portal");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Algo saiu do esperado. Tente novamente ou fale com a clínica.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto w-full max-w-md space-y-5 rounded-3xl border border-slate-200/90 bg-white p-6 shadow-lg shadow-slate-200/50 sm:p-8"
      aria-labelledby="login-heading"
    >
      <div>
        <h2 id="login-heading" className="text-2xl font-semibold text-slate-900">
          Entrar
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          E-mail e senha cadastrados na clínica. Você será levado automaticamente à área certa conforme seu perfil.
        </p>
      </div>

      {registeredHint ? (
        <div
          id={successId}
          className="rounded-xl border border-emerald-200/80 bg-emerald-50/90 px-4 py-3 text-sm leading-relaxed text-emerald-900"
          role="status"
        >
          <p className="font-medium">Cadastro concluído com sucesso.</p>
          <p className="mt-1 text-emerald-800/95">
            Agora é só entrar usando o e-mail e a senha que você acabou de criar.
          </p>
        </div>
      ) : null}

      <div className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="login-email" className="text-sm font-medium text-slate-800">
            E-mail
          </label>
          <input
            id="login-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-slate-50/40 px-4 py-3 text-slate-800 outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-200"
            placeholder="nome@email.com"
            aria-describedby={registeredHint ? successId : undefined}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="login-password" className="text-sm font-medium text-slate-800">
            Senha
          </label>
          <input
            id="login-password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-slate-50/40 px-4 py-3 text-slate-800 outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-200"
            placeholder="Sua senha de acesso"
          />
        </div>
      </div>

      {errorMessage ? (
        <p
          className="rounded-xl border border-rose-200/90 bg-rose-50 px-4 py-3 text-sm leading-relaxed text-rose-800"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-sky-600 px-4 py-3.5 text-sm font-semibold text-white shadow-sm shadow-sky-600/20 transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Abrindo seu acesso…" : "Entrar no portal"}
      </button>

      <p className="border-t border-slate-100 pt-5 text-center text-sm leading-relaxed text-slate-600">
        Não tem conta ainda?{" "}
        <Link href="/register" className="font-semibold text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-800">
          Cadastrar como paciente
        </Link>
      </p>
    </form>
  );
}
