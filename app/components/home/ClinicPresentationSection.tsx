import { SectionTitle } from "./SectionTitle";
import { Container, Section } from "../ui/SitePrimitives";

export function ClinicPresentationSection() {
  return (
    <Section id="sobre">
      <Container className="grid gap-10 lg:grid-cols-2 lg:items-start">
        <SectionTitle
          eyebrow="Apresentacao da clinica"
          title="Um espaco seguro para cuidar da sua saude emocional"
          subtitle="Unimos escuta qualificada, atendimento etico e acompanhamento individualizado para apoiar cada pessoa em seu processo de bem-estar e desenvolvimento."
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Escuta sem julgamentos</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Atendimentos baseados em etica, empatia e respeito a singularidade de cada paciente.
            </p>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Ambiente acolhedor</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Estrutura planejada para promover tranquilidade, conforto e sensacao de seguranca.
            </p>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:col-span-2">
            <h3 className="text-base font-semibold text-slate-900">Plano terapeutico com clareza</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              O processo e conduzido com objetivos definidos, acompanhamento continuo e foco na
              evolucao de cada paciente.
            </p>
          </article>
        </div>
      </Container>
    </Section>
  );
}
