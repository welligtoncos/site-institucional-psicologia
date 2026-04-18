import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "@/app/components/auth/LoginForm";
import { Container, Section } from "@/app/components/ui/SitePrimitives";

export const metadata: Metadata = {
  title: "Login",
  description: "Acesso ao portal interno do sistema.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LoginPage() {
  return (
    <Section className="bg-gradient-to-b from-sky-50 via-slate-50 to-white">
      <Container>
        <div className="grid gap-8 lg:grid-cols-[1.1fr_minmax(0,460px)] lg:items-center">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Portal do sistema</p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Entre no seu ambiente de usuario
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Acesse o portal interno com o mesmo padrao visual da Clinica Harmonia. Seu login e protegido
              com autenticacao JWT integrada ao backend principal.
            </p>

            <div className="mt-6 rounded-2xl border border-sky-100 bg-white/80 p-4 text-sm text-slate-700 shadow-sm">
              <p className="font-semibold text-slate-900">Acesso rapido</p>
              <p className="mt-2">Ainda nao tem conta? Cadastre-se como paciente.</p>
              <Link
                href="/register"
                className="mt-3 inline-flex rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-semibold text-sky-800 transition hover:bg-sky-100"
              >
                Criar conta
              </Link>
            </div>
          </div>

          <Suspense
            fallback={
              <div className="mx-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600 shadow-lg">
                Carregando formulario...
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
