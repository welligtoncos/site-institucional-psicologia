import type { Metadata } from "next";
import Link from "next/link";
import { AppointmentCta } from "../components/internal/AppointmentCta";
import { PageHero } from "../components/internal/PageHero";
import { Container, Section } from "../components/ui/SitePrimitives";

export const metadata: Metadata = {
  title: "Terapia para Ansiedade Online",
  description:
    "Psicologo online para ansiedade com atendimento acolhedor, tecnicas baseadas em evidencia e plano terapeutico personalizado.",
  alternates: {
    canonical: "/ansiedade",
  },
};

export default function AnsiedadePage() {
  return (
    <>
      <PageHero
        eyebrow="Ansiedade"
        title="Terapia para ansiedade com psicologo online"
        description="Acompanhamento psicologico para preocupacao constante, sobrecarga emocional, irritabilidade e sintomas de estresse no dia a dia."
      />
      <Section>
        <Container className="grid gap-6 md:grid-cols-2">
          <article className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Quando procurar ajuda</h2>
            <p className="mt-3 leading-relaxed text-slate-600">
              Se a ansiedade interfere no sono, concentracao, produtividade ou relacionamentos, iniciar terapia pode
              reduzir sintomas e trazer mais estabilidade emocional.
            </p>
          </article>
          <article className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Como funciona o acompanhamento</h2>
            <p className="mt-3 leading-relaxed text-slate-600">
              Cada sessao tem foco em identificar gatilhos, desenvolver estrategias praticas e construir rotinas mais
              saudaveis para lidar com momentos de crise.
            </p>
          </article>
        </Container>
        <Container className="mt-8">
          <p className="text-sm text-slate-600">
            Veja tambem:{" "}
            <Link href="/terapia-de-casal" className="font-semibold text-sky-700 underline underline-offset-2">
              Terapia de casal
            </Link>{" "}
            e{" "}
            <Link href="/autoestima" className="font-semibold text-sky-700 underline underline-offset-2">
              Terapia para autoestima
            </Link>
            .
          </p>
        </Container>
      </Section>
      <AppointmentCta
        title="Comece seu cuidado emocional com seguranca"
        description="Agende sua consulta online e receba um acompanhamento profissional para reduzir a ansiedade e retomar sua qualidade de vida."
      />
    </>
  );
}
