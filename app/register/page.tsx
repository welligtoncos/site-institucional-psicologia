import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "@/app/components/auth/RegisterForm";
import { Container, Section } from "@/app/components/ui/SitePrimitives";
import { siteConfig } from "@/app/lib/site";

export const metadata: Metadata = {
  title: "Cadastro de paciente",
  description: `Cadastro no portal da ${siteConfig.name}: dados para seu acesso reservado ao ambiente do paciente.`,
  robots: {
    index: false,
    follow: false,
  },
};

export default function RegisterPage() {
  return (
    <Section className="bg-gradient-to-b from-sky-50 via-slate-50 to-white">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[1.05fr_minmax(0,480px)] lg:items-start lg:gap-12">
          <div className="lg:pt-1">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
              {siteConfig.name}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Criar seu acesso ao portal
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Este cadastro é para <strong className="font-semibold text-slate-800">pacientes</strong> que desejam
              agendar consultas e acompanhar tudo pelo portal da clínica.
            </p>
            <p className="mt-3 max-w-xl text-sm text-slate-500">
              Leva menos de 2 minutos: informe e-mail, crie sua senha e pronto.
            </p>
            <ul className="mt-8 space-y-3 text-sm leading-relaxed text-slate-600">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-800">
                  1
                </span>
                <span>Crie sua conta com e-mail e senha.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-800">
                  2
                </span>
                <span>Entre no portal com os mesmos dados.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-800">
                  3
                </span>
                <span>Escolha profissional, horario e finalize seu agendamento.</span>
              </li>
            </ul>
            <p className="mt-3 text-sm text-slate-600">
              Já se cadastrou?{" "}
              <Link
                href="/login?next=/portal"
                className="font-semibold text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-800"
              >
                Ir para a tela de entrada
              </Link>
            </p>
          </div>
          <RegisterForm />
        </div>
      </Container>
    </Section>
  );
}
