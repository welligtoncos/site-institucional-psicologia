"use client";

import { FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { formatApiErrorDetail } from "@/app/lib/portal-errors";
import { savePortalPatientSnapshot } from "@/app/lib/portal-patient-snapshot";

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

  const formRef = useRef<HTMLFormElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  const nextPath = searchParams.get("next");

  /** Só visual do paciente: portal, subrotas, ou URL sem `next` (padrão paciente). */
  const patientOnlyVisual = useMemo(() => {
    if (!nextPath) return true;
    return nextPath === "/portal" || nextPath.startsWith("/portal/");
  }, [nextPath]);

  /** Só visual do psicólogo quando `next` aponta para /psicologo. */
  const psychologistOnlyVisual = useMemo(() => {
    return !!nextPath && nextPath.startsWith("/psicologo");
  }, [nextPath]);

  const isPsychologistIntent = psychologistOnlyVisual;

  useEffect(() => {
    if (searchParams.get("registered") === "1") {
      setRegisteredHint(true);
    }
  }, [searchParams]);

  /** Fluxo “Agendar” no site: links trazem `focus=email` para ir direto ao formulário no mobile. */
  useEffect(() => {
    const raw = searchParams.get("focus");
    if (raw !== "email" && raw !== "1") return;
    /** DOM devolve `number`; com @types/node o mesmo call pode tipar como `NodeJS.Timeout` no build. */
    let innerTimer: number | NodeJS.Timeout | undefined;
    const outerTimer = window.setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      innerTimer = window.setTimeout(() => {
        emailRef.current?.focus({ preventScroll: true });
      }, 350);
    }, 50);
    return () => {
      clearTimeout(outerTimer);
      if (innerTimer !== undefined) clearTimeout(innerTimer);
    };
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
      const meData = (await meRes.json()) as { role?: string; name?: string; email?: string };

      if (meRes.ok && meData.role === "admin") {
        const dest = next && next.startsWith("/admin") ? next : "/admin/dashboard";
        router.push(dest);
        return;
      }

      if (meRes.ok && meData.role === "psychologist") {
        const dest = next && next.startsWith("/psicologo") ? next : "/psicologo";
        router.push(dest);
        return;
      }

      if (meRes.ok && meData.role === "patient") {
        if (typeof meData.name === "string" && typeof meData.email === "string") {
          savePortalPatientSnapshot({ name: meData.name, email: meData.email });
        }
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

  const theme = isPsychologistIntent
    ? {
        shell: "border-emerald-200/90 bg-gradient-to-br from-white to-emerald-50/40 shadow-emerald-100/40",
        heading: "text-emerald-950",
        sub: "text-emerald-900/75",
        input: "focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-200/90",
        btn: "bg-emerald-600 shadow-emerald-700/25 hover:bg-emerald-700",
        link: "text-emerald-800 decoration-emerald-300 hover:text-emerald-950",
      }
    : {
        shell: "border-sky-200/90 bg-gradient-to-br from-white to-sky-50/40 shadow-sky-100/40",
        heading: "text-slate-900",
        sub: "text-slate-600",
        input: "focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-200/90",
        btn: "bg-sky-600 shadow-sky-700/25 hover:bg-sky-700",
        link: "text-sky-700 decoration-sky-300 hover:text-sky-800",
      };

  const heading = isPsychologistIntent ? "Área do psicólogo" : "Portal do paciente";
  const lead = isPsychologistIntent
    ? "Acesse agenda, pacientes e faturas. O sistema confirma seu perfil profissional após o login."
    : "Agende consultas, acompanhe sessões e pagamentos com o e-mail e a senha da clínica.";

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className={`mx-auto w-full max-w-md space-y-5 rounded-3xl border-2 ${theme.shell} p-6 shadow-xl sm:p-8`}
      aria-labelledby="login-heading"
    >
      <div>
        <h2 id="login-heading" className={`text-2xl font-semibold tracking-tight ${theme.heading}`}>
          {heading}
        </h2>
        <p className={`mt-2 text-sm leading-relaxed ${theme.sub}`}>{lead}</p>
        {psychologistOnlyVisual ? (
          <p className="mt-3 rounded-xl border border-emerald-100/90 bg-emerald-50/50 px-3 py-2 text-xs leading-relaxed text-slate-600">
            <strong className="font-semibold text-slate-800">Segurança:</strong> o acesso profissional só é liberado para
            contas de psicólogo ou administrador.
          </p>
        ) : null}
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
            ref={emailRef}
            id="login-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={`w-full rounded-xl border border-slate-300 bg-slate-50/40 px-4 py-3 text-slate-800 outline-none transition ${theme.input}`}
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
            className={`w-full rounded-xl border border-slate-300 bg-slate-50/40 px-4 py-3 text-slate-800 outline-none transition ${theme.input}`}
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
        className={`w-full rounded-full px-4 py-3.5 text-sm font-semibold text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-60 ${theme.btn}`}
      >
        {loading
          ? isPsychologistIntent
            ? "Abrindo área profissional…"
            : "Abrindo seu portal…"
          : isPsychologistIntent
            ? "Entrar como psicólogo"
            : "Entrar no portal"}
      </button>

      <p className="border-t border-slate-200/80 pt-5 text-center text-sm leading-relaxed text-slate-600">
        {patientOnlyVisual ? (
          <>
            <Link
              href="/register"
              className="font-semibold text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-800"
            >
              Cadastrar como paciente
            </Link>
          </>
        ) : (
          <>
            <Link
              href="/login?next=/portal"
              className={`font-semibold underline underline-offset-2 ${theme.link}`}
            >
              Portal do paciente
            </Link>
            {" · "}
            <Link href="/register" className={`font-semibold underline underline-offset-2 ${theme.link}`}>
              Cadastro de paciente
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
