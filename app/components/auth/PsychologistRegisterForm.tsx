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

export function PsychologistRegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [crp, setCrp] = useState("");
  const [bio, setBio] = useState("");
  const [valorSessao, setValorSessao] = useState("");
  const [duracaoMin, setDuracaoMin] = useState("");
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

    const payload: Record<string, unknown> = {
      name: name.trim(),
      email: email.trim(),
      phone,
      password,
      accept_terms: true,
      crp: crp.trim(),
      bio: bio.trim(),
    };

    const vs = valorSessao.trim().replace(",", ".");
    if (vs !== "") {
      const n = Number(vs);
      if (!Number.isFinite(n) || n < 0) {
        setErrorMessage("Informe um valor de sessão válido ou deixe em branco.");
        setLoading(false);
        return;
      }
      payload.valor_sessao_padrao = n;
    }

    const dm = duracaoMin.trim();
    if (dm !== "") {
      const d = parseInt(dm, 10);
      if (!Number.isFinite(d) || d < 15 || d > 240) {
        setErrorMessage("Duração deve estar entre 15 e 240 minutos, ou deixe em branco.");
        setLoading(false);
        return;
      }
      payload.duracao_minutos_padrao = d;
    }

    try {
      const response = await fetch("/api/portal/register/psychologist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as RegisterResponse;
      if (!response.ok) {
        throw new Error(formatApiErrorDetail(data, "Não foi possível concluir o cadastro. Verifique os dados."));
      }

      router.push("/login?registered=1&role=psychologist");
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
      aria-labelledby="register-psych-heading"
    >
      <div>
        <h2 id="register-psych-heading" className="text-2xl font-semibold text-slate-900">
          Cadastro profissional
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Seus dados serão gravados no sistema: conta de usuário com perfil de psicólogo e registro do CRP conforme a
          base de dados da clínica.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="psych-name" className="text-sm font-medium text-slate-800">
          Nome completo
        </label>
        <input
          id="psych-name"
          name="name"
          type="text"
          required
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-slate-50/40 px-4 py-3 text-slate-800 outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-200"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="psych-email" className="text-sm font-medium text-slate-800">
          E-mail
        </label>
        <input
          id="psych-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-slate-50/40 px-4 py-3 text-slate-800 outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-200"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="psych-phone" className="text-sm font-medium text-slate-800">
          Celular ou telefone (com DDD)
        </label>
        <input
          id="psych-phone"
          name="phone"
          type="tel"
          required
          minLength={8}
          maxLength={30}
          autoComplete="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-slate-50/40 px-4 py-3 text-slate-800 outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-200"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="psych-crp" className="text-sm font-medium text-slate-800">
          CRP
        </label>
        <input
          id="psych-crp"
          name="crp"
          type="text"
          required
          minLength={5}
          maxLength={32}
          value={crp}
          onChange={(e) => setCrp(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-slate-50/40 px-4 py-3 text-slate-800 outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-200"
          placeholder="Ex.: 06/123456-SP"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="psych-bio" className="text-sm font-medium text-slate-800">
          Apresentação (bio)
        </label>
        <textarea
          id="psych-bio"
          name="bio"
          rows={4}
          maxLength={8000}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          className="w-full resize-y rounded-xl border border-slate-300 bg-slate-50/40 px-4 py-3 text-slate-800 outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-200"
          placeholder="Abordagens, experiência, público que atende…"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="psych-valor" className="text-sm font-medium text-slate-800">
            Valor padrão da sessão (opcional)
          </label>
          <input
            id="psych-valor"
            name="valor_sessao_padrao"
            type="text"
            inputMode="decimal"
            value={valorSessao}
            onChange={(e) => setValorSessao(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-slate-50/40 px-4 py-3 text-slate-800 outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-200"
            placeholder="Ex.: 180 ou 180,50"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="psych-duracao" className="text-sm font-medium text-slate-800">
            Duração padrão (min, opcional)
          </label>
          <input
            id="psych-duracao"
            name="duracao_minutos_padrao"
            type="number"
            min={15}
            max={240}
            value={duracaoMin}
            onChange={(e) => setDuracaoMin(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-slate-50/40 px-4 py-3 text-slate-800 outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-200"
            placeholder="Padrão: 50"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="psych-password" className="text-sm font-medium text-slate-800">
          Senha
        </label>
        <input
          id="psych-password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-slate-50/40 px-4 py-3 text-slate-800 outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-200"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="psych-password-confirm" className="text-sm font-medium text-slate-800">
          Repetir senha
        </label>
        <input
          id="psych-password-confirm"
          name="password-confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-slate-50/40 px-4 py-3 text-slate-800 outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-200"
        />
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-3 text-sm leading-relaxed text-slate-700">
        <input
          type="checkbox"
          checked={acceptTerms}
          onChange={(e) => setAcceptTerms(e.target.checked)}
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
        {loading ? "Salvando cadastro…" : "Concluir cadastro de psicólogo"}
      </button>

      <p className="border-t border-slate-100 pt-5 text-center text-sm leading-relaxed text-slate-600">
        É paciente?{" "}
        <Link
          href="/register"
          className="font-semibold text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-800"
        >
          Cadastro de paciente
        </Link>
        {" · "}
        <Link
          href="/login?next=/portal"
          className="font-semibold text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-800"
        >
          Entrar
        </Link>
      </p>
    </form>
  );
}
