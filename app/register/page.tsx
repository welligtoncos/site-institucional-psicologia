import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "@/app/components/auth/RegisterForm";
import { Container, Section } from "@/app/components/ui/SitePrimitives";

export const metadata: Metadata = {
  title: "Cadastro",
  description: "Criar conta de paciente no portal.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RegisterPage() {
  return (
    <Section className="bg-gradient-to-b from-sky-50 via-slate-50 to-white">
      <Container>
        <div className="grid gap-8 lg:grid-cols-[1.1fr_minmax(0,460px)] lg:items-center">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Novo paciente</p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Cadastro no portal
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Informe nome, e-mail, telefone e senha. O aceite dos termos e obrigatorio para criar a conta e
              acessar o ambiente (RF-001).
            </p>
            <p className="mt-4 text-sm text-slate-600">
              <Link href="/login" className="font-semibold text-sky-700">
                Voltar ao login
              </Link>
            </p>
          </div>
          <RegisterForm />
        </div>
      </Container>
    </Section>
  );
}
