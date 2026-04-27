import type { Metadata } from "next";
import { AppointmentCta } from "../components/internal/AppointmentCta";
import { PageHero } from "../components/internal/PageHero";
import { Container, Section } from "../components/ui/SitePrimitives";

export const metadata: Metadata = {
  title: "Sobre a Clinica | Psicologo Online Ja",
  description:
    "Conheca o Psicologo Online Ja, nossa missao, visao e valores no atendimento psicologico online acolhedor, etico e baseado em evidencia.",
  alternates: {
    canonical: "/sobre",
  },
};

export default function SobrePage() {
  return (
    <>
      <PageHero
        eyebrow="Sobre a clinica"
        title="Cuidado psicologico com acolhimento, etica e excelencia"
        description="O Psicologo Online Ja nasceu para oferecer um espaco seguro de escuta e transformacao, com atendimentos baseados em ciencia, empatia e respeito a historia de cada pessoa."
      />

      <Section>
        <Container className="grid gap-6 md:grid-cols-2">
          <article className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Nossa missao</h2>
            <p className="mt-3 leading-relaxed text-slate-600">
              Promover saude mental e qualidade de vida por meio de um atendimento psicologico
              humanizado, tecnico e comprometido com a evolucao de cada paciente.
            </p>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Nossa visao</h2>
            <p className="mt-3 leading-relaxed text-slate-600">
              Ser referencia em psicologia clinica, reconhecida pela seriedade profissional, pela
              qualidade do cuidado e pelo impacto positivo na vida das pessoas.
            </p>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm md:col-span-2">
            <h2 className="text-xl font-semibold text-slate-900">Nossos valores</h2>
            <p className="mt-3 leading-relaxed text-slate-600">
              Atuamos com etica, sigilo, respeito, escuta ativa e compromisso com o desenvolvimento.
              Cada atendimento e conduzido com sensibilidade e responsabilidade clinica.
            </p>
          </article>
        </Container>
      </Section>

      <AppointmentCta
        title="Vamos construir esse processo juntos"
        description="Se voce busca um atendimento profissional e acolhedor, entre em contato para iniciar sua jornada de cuidado emocional."
      />
    </>
  );
}
