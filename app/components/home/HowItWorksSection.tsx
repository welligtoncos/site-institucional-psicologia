import { SectionTitle } from "./SectionTitle";
import { Container, Section } from "../ui/SitePrimitives";

const steps = [
  {
    step: "1",
    title: "Primeiro contato",
    description: "Voce envia uma mensagem e nossa equipe orienta sobre modalidades, agenda e valores.",
  },
  {
    step: "2",
    title: "Triagem inicial",
    description: "Entendemos suas necessidades e indicamos o profissional mais adequado ao seu perfil.",
  },
  {
    step: "3",
    title: "Inicio da terapia",
    description: "As sessoes sao conduzidas com plano terapeutico, acompanhamento e metas de evolucao.",
  },
];

export function HowItWorksSection() {
  return (
    <Section id="atendimento">
      <Container>
        <SectionTitle
          eyebrow="Como funciona o atendimento"
          title="Um processo simples, humano e organizado"
          subtitle="Da primeira conversa ao acompanhamento continuo, cada etapa e pensada para trazer clareza, seguranca e acolhimento."
        />

        <div className="mt-8 grid gap-4 sm:mt-10 md:grid-cols-3">
          {steps.map((item) => (
            <article key={item.step} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-sky-700">
                {item.step}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.description}</p>
            </article>
          ))}
        </div>
      </Container>
    </Section>
  );
}
