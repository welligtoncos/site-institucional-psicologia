"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type RegisterResponse = {
  id?: string;
  email?: string;
  detail?: string;
  message?: string;
};

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setErrorMessage("");

    if (!acceptTerms) {
      setErrorMessage("Voce precisa aceitar os termos de uso para continuar.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/portal/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          password,
          accept_terms: true,
        }),
      });

      const data = (await response.json()) as RegisterResponse;
      if (!response.ok) {
        const msg =
          typeof data.detail === "string"
            ? data.detail
            : Array.isArray(data.detail)
              ? data.detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join(" ")
              : "Falha no cadastro.";
        throw new Error(msg || "Falha no cadastro.");
      }

      router.push("/login?registered=1");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Nao foi possivel cadastrar.");
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
        <h2 className="text-2xl font-semibold text-slate-900">Criar conta de paciente</h2>
        <p className="mt-1 text-sm text-slate-600">Preencha os dados para acessar o portal.</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="name" className="text-sm font-medium text-slate-700">
          Nome completo
        </label>
        <input
          id="name"
          type="text"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-slate-50/40 px-4 py-3 text-slate-800 outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-200"
          placeholder="Seu nome"
        />
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
        <label htmlFor="phone" className="text-sm font-medium text-slate-700">
          Telefone (com DDD)
        </label>
        <input
          id="phone"
          type="tel"
          required
          minLength={8}
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-slate-50/40 px-4 py-3 text-slate-800 outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-200"
          placeholder="11999998888"
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
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-slate-50/40 px-4 py-3 text-slate-800 outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-200"
          placeholder="Minimo 8 caracteres"
        />
      </div>

      <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={acceptTerms}
          onChange={(event) => setAcceptTerms(event.target.checked)}
          className="mt-1 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
        />
        <span>
          Li e aceito os <span className="font-semibold">termos de uso</span> e a{" "}
          <span className="font-semibold">politica de privacidade</span>.
        </span>
      </label>

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
        {loading ? "Cadastrando..." : "Criar conta"}
      </button>

      <p className="text-center text-sm text-slate-600">
        Ja tem conta?{" "}
        <Link href="/login" className="font-semibold text-sky-700">
          Entrar
        </Link>
      </p>
    </form>
  );
}
