import { ActionLink, Container, Section } from "../ui/SitePrimitives";

type AppointmentCtaProps = {
  title: string;
  description: string;
};

export function AppointmentCta({ title, description }: AppointmentCtaProps) {
  return (
    <Section className="pt-6">
      <Container>
        <div className="rounded-3xl border border-sky-200 bg-gradient-to-r from-sky-50 via-white to-sky-100/60 p-8 shadow-sm md:p-12">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">
            {title}
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-600 sm:text-lg">{description}</p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <ActionLink href="/contato">
              Agendar atendimento
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
