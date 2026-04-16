import { SectionTitle } from "./SectionTitle";
import { ActionLink, Container, Section } from "../ui/SitePrimitives";

export function SchedulingCtaSection() {
  return (
    <Section id="agendamento" className="pt-0">
      <Container>
        <div className="rounded-3xl border border-sky-200 bg-gradient-to-r from-sky-50 via-white to-sky-100/60 p-8 shadow-sm md:p-12">
          <SectionTitle
            eyebrow="Agendamento"
            title="Comece seu cuidado emocional hoje"
            subtitle="Entre em contato para agendar sua primeira consulta e conhecer a abordagem terapeutica mais indicada para voce."
          />

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <ActionLink href="/contato">
              Quero agendar minha consulta
            </ActionLink>
            <ActionLink href="/sobre" variant="secondary">
              Conhecer a clinica
            </ActionLink>
          </div>
        </div>
      </Container>
    </Section>
  );
}
