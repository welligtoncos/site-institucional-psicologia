"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { formatApiErrorDetail } from "@/app/lib/portal-errors";

type RegisterResponse = {
  id?: string;
  email?: string;
  detail?: unknown;
};

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setErrorMessage("");

    if (!acceptTerms) {
      setErrorMessage("Para continuar, marque a caixa confirmando que leu e aceita os termos.");
      setLoading(false);
      return;
    }

    if (password !== passwordConfirm) {
      setErrorMessage("As duas senhas precisam ser iguais. Confira e tente de novo.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/portal/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone,
          password,
          accept_terms: true,
        }),
      });

      const data = (await response.json()) as RegisterResponse;
      if (!response.ok) {
        throw new Error(formatApiErrorDetail(data, "Não foi possível concluir o cadastro. Verifique os dados."));
      }

      router.push("/login?registered=1");
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
      aria-labelledby="register-heading"
    >
      <div>
        <h2 id="register-heading" className="text-2xl font-semibold text-slate-900">
          Dados do cadastro
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Mesmo que você já seja atendido presencialmente, use aqui o e-mail que quiser para o acesso online — ele será
          seu usuário no portal.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="register-name" className="text-sm font-medium text-slate-800">
          Nome completo
        </label>
        <input
          id="register-name"
          name="name"
          type="text"
          required
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-slate-50/40 px-4 py-3 text-slate-800 outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-200"
          placeholder="Como prefere ser chamado(a) no cadastro"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="register-email" className="text-sm font-medium text-slate-800">
          E-mail
        </label>
        <input
          id="register-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-slate-50/40 px-4 py-3 text-slate-800 outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-200"
          placeholder="nome@email.com"
        />
        <p className="text-xs text-slate-500">Será usado para você entrar no portal.</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="register-phone" className="text-sm font-medium text-slate-800">
          Celular ou telefone (com DDD)
        </label>
        <input
          id="register-phone"
          name="phone"
          type="tel"
          required
          minLength={8}
          maxLength={30}
          autoComplete="tel"
          inputMode="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-slate-50/40 px-4 py-3 text-slate-800 outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-200"
          placeholder="(11) 99999-9999 ou 11999998888"
        />
        <p className="text-xs text-slate-500">Mínimo de 8 números, com DDD.</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="register-password" className="text-sm font-medium text-slate-800">
          Senha
        </label>
        <input
          id="register-password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-slate-50/40 px-4 py-3 text-slate-800 outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-200"
          placeholder="No mínimo 8 caracteres"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="register-password-confirm" className="text-sm font-medium text-slate-800">
          Repetir senha
        </label>
        <input
          id="register-password-confirm"
          name="password-confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={passwordConfirm}
          onChange={(event) => setPasswordConfirm(event.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-slate-50/40 px-4 py-3 text-slate-800 outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-200"
          placeholder="Digite a mesma senha de cima"
        />
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-3 text-sm leading-relaxed text-slate-700">
        <input
          type="checkbox"
          checked={acceptTerms}
          onChange={(event) => setAcceptTerms(event.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
        />
        <span>
          Declaro que li e aceito os <span className="font-semibold text-slate-800">termos de uso</span> e a{" "}
          <span className="font-semibold text-slate-800">política de privacidade</span> deste portal.
        </span>
      </label>

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
        {loading ? "Salvando seu cadastro…" : "Concluir cadastro"}
      </button>

      <p className="border-t border-slate-100 pt-5 text-center text-sm leading-relaxed text-slate-600">
        Já possui acesso?{" "}
        <Link
          href="/login"
          className="font-semibold text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-800"
        >
          Voltar para a entrada
        </Link>
      </p>
    </form>
  );
}
