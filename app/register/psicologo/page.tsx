import type { Metadata } from "next";
import Link from "next/link";
import { PsychologistRegisterForm } from "@/app/components/auth/PsychologistRegisterForm";
import { Container, Section } from "@/app/components/ui/SitePrimitives";
import { siteConfig } from "@/app/lib/site";

export const metadata: Metadata = {
  title: "Cadastro de psicólogo",
  description: `Cadastro profissional no portal da ${siteConfig.name}: conta com perfil de psicólogo e CRP.`,
  robots: {
    index: false,
    follow: false,
  },
};

export default function RegisterPsychologistPage() {
  return (
    <Section className="bg-gradient-to-b from-sky-50 via-slate-50 to-white">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[1.05fr_minmax(0,520px)] lg:items-start lg:gap-12">
          <div className="lg:pt-1">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">{siteConfig.name}</p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Cadastro para psicólogos
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Este fluxo cria sua conta com o papel de <strong className="font-semibold text-slate-800">psicólogo</strong>{" "}
              e grava o perfil clínico (CRP, bio e parâmetros opcionais de sessão) diretamente no banco de dados,
              junto com o cadastro de usuário.
            </p>
            <p className="mt-8 text-sm text-slate-600">
              <Link
                href="/register"
                className="font-semibold text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-800"
              >
                Cadastro de paciente
              </Link>
            </p>
          </div>
          <PsychologistRegisterForm />
        </div>
      </Container>
    </Section>
  );
}
