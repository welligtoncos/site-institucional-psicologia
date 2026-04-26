import type { Metadata } from "next";
import Link from "next/link";
import { AppointmentCta } from "../components/internal/AppointmentCta";
import { PageHero } from "../components/internal/PageHero";
import { Container, Section } from "../components/ui/SitePrimitives";

export const metadata: Metadata = {
  title: "Terapia para Depressao Online",
  description:
    "Psicologo online para depressao com acolhimento, escuta tecnica e plano terapeutico para retomar rotina, energia e bem-estar.",
  alternates: {
    canonical: "/depressao",
  },
};

export default function DepressaoPage() {
  return (
    <>
      <PageHero
        eyebrow="Depressao e luto"
        title="Terapia para depressao com acompanhamento continuo"
        description="Atendimento psicologico para tristeza persistente, desanimo, isolamento e perda de interesse nas atividades da rotina."
      />
      <Section>
        <Container className="grid gap-6 md:grid-cols-2">
          <article className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Sinais de alerta</h2>
            <p className="mt-3 leading-relaxed text-slate-600">
              Alteracoes de sono, cansaco constante, desesperanca, dificuldade para cumprir compromissos e prejuizo na
              vida pessoal ou profissional.
            </p>
          </article>
          <article className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Abordagem terapeutica</h2>
            <p className="mt-3 leading-relaxed text-slate-600">
              A terapia ajuda a reorganizar pensamentos, recuperar autonomia emocional e criar passos praticos para
              retomada gradual da rotina.
            </p>
          </article>
        </Container>
        <Container className="mt-8">
          <p className="text-sm text-slate-600">
            Veja tambem:{" "}
            <Link href="/ansiedade" className="font-semibold text-sky-700 underline underline-offset-2">
              Terapia para ansiedade
            </Link>{" "}
            e{" "}
            <Link href="/autoestima" className="font-semibold text-sky-700 underline underline-offset-2">
              Autoconhecimento e autoestima
            </Link>
            .
          </p>
        </Container>
      </Section>
      <AppointmentCta
        title="Receba apoio profissional no seu tempo"
        description="Inicie a terapia online com um plano estruturado para recuperar bem-estar emocional e qualidade de vida."
      />
    </>
  );
}
