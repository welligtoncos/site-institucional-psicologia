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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setErrorMessage("");

    if (password !== passwordConfirm) {
      setErrorMessage("As duas senhas precisam ser iguais. Confira e tente de novo.");
      setLoading(false);
      return;
    }

    const emailTrim = email.trim();
    if (!emailTrim) {
      setErrorMessage("Informe um e-mail válido.");
      setLoading(false);
      return;
    }

    try {
      const body: Record<string, unknown> = {
        name: "",
        email: emailTrim,
        password,
        accept_terms: true,
      };

      const response = await fetch("/api/portal/register/patient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
          Use o e-mail que quiser para o acesso online — ele será seu usuário no portal. Você poderá informar seu nome
          completo depois em Meu cadastro.
        </p>
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
          placeholder="Digite a mesma senha"
        />
      </div>

      <p className="text-xs leading-relaxed text-slate-500">
        Ao concluir o cadastro, você declara ter lido e aceito os{" "}
        <Link href="/contato" className="font-medium text-sky-800 underline hover:text-sky-950">
          termos de uso
        </Link>{" "}
        e a{" "}
        <Link href="/contato" className="font-medium text-sky-800 underline hover:text-sky-950">
          política de privacidade
        </Link>
        .
      </p>

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
        É psicólogo(a)?{" "}
        <Link
          href="/register/psicologo"
          className="font-semibold text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-800"
        >
          Cadastro profissional
        </Link>
        <br />
        Já possui acesso?{" "}
        <Link
          href="/login?next=/portal"
          className="font-semibold text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-800"
        >
          Voltar para a entrada
        </Link>
      </p>
    </form>
  );
}
