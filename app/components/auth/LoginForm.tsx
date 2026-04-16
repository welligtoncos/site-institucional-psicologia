"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const ACCESS_TOKEN_KEY = "portal_access_token";
const REFRESH_TOKEN_KEY = "portal_refresh_token";

type LoginResponse = {
  access_token?: string;
  refresh_token?: string;
  detail?: string;
};

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/portal/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = (await response.json()) as LoginResponse;
      if (!response.ok || !data.access_token || !data.refresh_token) {
        throw new Error(data.detail || "Falha no login.");
      }

      window.localStorage.setItem(ACCESS_TOKEN_KEY, data.access_token);
      window.localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
      const params = new URLSearchParams(window.location.search);
      router.push(params.get("next") || "/portal");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Nao foi possivel autenticar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto w-full max-w-md space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/60 sm:p-7"
    >
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Login do portal</h2>
        <p className="mt-1 text-sm text-slate-600">Use suas credenciais para entrar no ambiente interno.</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium text-slate-700">
          E-mail
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-slate-50/40 px-4 py-3 text-slate-800 outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-200"
          placeholder="usuario@exemplo.com"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium text-slate-700">
          Senha
        </label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-slate-50/40 px-4 py-3 text-slate-800 outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-200"
          placeholder="Sua senha"
        />
      </div>

      {errorMessage ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {errorMessage}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Entrando..." : "Entrar no portal"}
      </button>
    </form>
  );
}
