import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
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

export default function LoginPage() {
  return (
    <Section className="bg-gradient-to-b from-sky-50 via-slate-50 to-white">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[1.05fr_minmax(0,460px)] lg:items-start lg:gap-12">
          <div className="lg:pt-1">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
              {siteConfig.name}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Entrar na sua conta
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Use o e-mail e a senha cadastrados. O sistema identifica seu perfil e abre o portal do paciente ou a área
              do psicólogo, conforme o caso.
            </p>
            <p className="mt-3 max-w-xl text-sm text-slate-500">
              Em caso de dúvida sobre o acesso, fale com a recepção ou pelo nosso contato no site.
            </p>

            <div className="mt-8 rounded-2xl border border-sky-100/80 bg-white/90 p-5 shadow-sm ring-1 ring-slate-100">
              <p className="text-sm font-semibold text-slate-900">Ainda não tem cadastro de paciente?</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Crie sua conta em poucos passos e depois volte aqui para entrar com o mesmo e-mail e senha.
              </p>
              <Link
                href="/register"
                className="mt-4 inline-flex rounded-full border border-sky-200 bg-sky-50 px-5 py-2.5 text-sm font-semibold text-sky-900 transition hover:bg-sky-100"
              >
                Quero me cadastrar
              </Link>
            </div>
          </div>

          <Suspense
            fallback={
              <div className="mx-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600 shadow-lg">
                Carregando…
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
