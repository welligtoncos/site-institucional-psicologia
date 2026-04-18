import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { LoginForm } from "@/app/components/auth/LoginForm";
import { Container, Section } from "@/app/components/ui/SitePrimitives";
import { siteConfig } from "@/app/lib/site";

export const metadata: Metadata = {
  title: "Entrar no portal",
  description: `Acesso reservado à ${siteConfig.name}: pacientes e profissionais usam o mesmo login; o sistema abre a área correspondente ao seu perfil.`,
  robots: {
    index: false,
    follow: false,
  },
};

function normalizeNext(next: string | string[] | undefined): string | undefined {
  if (next === undefined) return undefined;
  const v = Array.isArray(next) ? next[0] : next;
  return v || undefined;
}

type LoginPageProps = {
  searchParams: Promise<{ next?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const sp = await searchParams;
  const next = normalizeNext(sp.next);
  const patientOnlyPage =
    !next || next === "/portal" || (typeof next === "string" && next.startsWith("/portal/"));
  const psychologistOnlyPage = typeof next === "string" && next.startsWith("/psicologo");

  return (
    <Section
      className={
        patientOnlyPage
          ? "relative overflow-hidden bg-gradient-to-b from-sky-50/95 via-white to-sky-50/40"
          : psychologistOnlyPage
            ? "relative overflow-hidden bg-gradient-to-b from-emerald-50/95 via-white to-emerald-50/40"
            : "relative overflow-hidden bg-gradient-to-b from-sky-50/90 via-white to-emerald-50/70"
      }
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(14,165,233,0.18),transparent)]"
        aria-hidden
      />
      {!patientOnlyPage ? (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-[radial-gradient(ellipse_70%_50%_at_80%_100%,rgba(16,185,129,0.14),transparent)]"
          aria-hidden
        />
      ) : null}

      <Container className="relative">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_minmax(0,460px)] lg:items-start lg:gap-14">
          <div className="lg:pt-2">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{siteConfig.name}</p>

            {patientOnlyPage ? (
              <>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                  Entrar no portal do paciente
                </h1>
                <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
                  Use o e-mail e a senha do seu cadastro para acessar consultas, pagamentos e o histórico no ambiente
                  do paciente.
                </p>

                <div className="mt-8">
                  <div className="group relative overflow-hidden rounded-2xl border border-sky-200/90 bg-white/95 p-6 shadow-sm ring-1 ring-sky-100/80">
                    <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-sky-100/90 blur-2xl" />
                    <p className="relative text-xs font-bold uppercase tracking-[0.15em] text-sky-700">No portal</p>
                    <ul className="relative mt-4 space-y-2.5 text-sm leading-relaxed text-slate-600">
                      <li className="flex gap-2">
                        <span className="text-sky-500">✓</span> Agendar e gerenciar consultas
                      </li>
                      <li className="flex gap-2">
                        <span className="text-sky-500">✓</span> Pagamentos e faturamento
                      </li>
                      <li className="flex gap-2">
                        <span className="text-sky-500">✓</span> Acompanhar seu histórico
                      </li>
                    </ul>
                  </div>
                </div>
              </>
            ) : psychologistOnlyPage ? (
              <>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                  Área do psicólogo
                </h1>
                <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
                  Acesso reservado a profissionais cadastrados. Use o mesmo login institucional.
                </p>

                <div className="mt-8">
                  <div className="group relative overflow-hidden rounded-2xl border border-emerald-200/90 bg-white/95 p-6 shadow-sm ring-1 ring-emerald-100/80">
                    <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-100/90 blur-2xl" />
                    <p className="relative text-xs font-bold uppercase tracking-[0.15em] text-emerald-800">No painel</p>
                    <ul className="relative mt-4 space-y-2.5 text-sm leading-relaxed text-slate-600">
                      <li className="flex gap-2">
                        <span className="text-emerald-600">✓</span> Agenda e confirmações
                      </li>
                      <li className="flex gap-2">
                        <span className="text-emerald-600">✓</span> Pacientes e faturas
                      </li>
                      <li className="flex gap-2">
                        <span className="text-emerald-600">✓</span> Disponibilidade e bloqueios
                      </li>
                    </ul>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Iniciar sessão</h1>
                <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
                  Um único login para pacientes e profissionais. Escolha o caminho adequado.
                </p>
                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  <Link
                    href="/login?next=/portal"
                    className="group relative overflow-hidden rounded-2xl border border-sky-200/90 bg-white/90 p-5 shadow-sm ring-1 ring-sky-100/80 transition hover:border-sky-300 hover:shadow-md"
                  >
                    <p className="text-xs font-bold uppercase tracking-[0.15em] text-sky-700">Paciente</p>
                    <p className="mt-2 text-base font-semibold text-slate-900">Portal do paciente</p>
                    <span className="mt-4 inline-flex text-xs font-semibold text-sky-800 group-hover:underline">
                      Entrar →
                    </span>
                  </Link>
                  <Link
                    href="/login?next=/psicologo"
                    className="group relative overflow-hidden rounded-2xl border border-emerald-200/90 bg-white/90 p-5 shadow-sm ring-1 ring-emerald-100/80 transition hover:border-emerald-300 hover:shadow-md"
                  >
                    <p className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-800">Profissional</p>
                    <p className="mt-2 text-base font-semibold text-slate-900">Área do psicólogo</p>
                    <span className="mt-4 inline-flex text-xs font-semibold text-emerald-900 group-hover:underline">
                      Entrar →
                    </span>
                  </Link>
                </div>
              </>
            )}

            {patientOnlyPage ? (
              <div className="mt-8 rounded-2xl border border-slate-200/80 bg-white/70 p-5 shadow-sm backdrop-blur-sm">
                <p className="text-sm font-semibold text-slate-900">Primeiro acesso?</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Crie sua conta de paciente e volte aqui com o mesmo e-mail e senha.
                </p>
                <Link
                  href="/register"
                  className="mt-4 inline-flex rounded-full border border-sky-200 bg-sky-50 px-5 py-2.5 text-sm font-semibold text-sky-900 transition hover:bg-sky-100"
                >
                  Quero me cadastrar
                </Link>
              </div>
            ) : null}

            <p className="mt-6 text-xs text-slate-500">
              Dúvidas sobre credenciais? Fale com a recepção ou use o{" "}
              <Link href="/contato" className="font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900">
                contato
              </Link>{" "}
              do site.
            </p>
          </div>

          <Suspense
            fallback={
              <div className="mx-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white/90 p-10 text-center text-sm text-slate-600 shadow-xl">
                <p className="animate-pulse">Carregando formulário…</p>
              </div>
            }
          >
            <LoginForm />
          </Suspense>
        </div>
      </Container>
    </Section>
  );
}
