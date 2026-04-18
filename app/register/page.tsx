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
              acompanhar informações pelo site da clínica. Pedimos nome, e-mail, telefone e uma senha — e a confirmação
              de que você leu e aceita os termos de uso.
            </p>
            <p className="mt-3 max-w-xl text-sm text-slate-500">
              Seus dados são tratados com cuidado e usados para identificar seu acesso de forma segura.
            </p>
            <ul className="mt-8 space-y-3 text-sm leading-relaxed text-slate-600">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-800">
                  1
                </span>
                <span>Preencha o formulário ao lado com atenção.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-800">
                  2
                </span>
                <span>Depois, na tela de entrada, use o mesmo e-mail e a mesma senha para entrar.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-800">
                  3
                </span>
                <span>Você será levado ao painel do paciente no portal.</span>
              </li>
            </ul>
            <p className="mt-8 text-sm text-slate-600">
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
