import { SectionTitle } from "./SectionTitle";
import { Container, Section } from "../ui/SitePrimitives";

const steps = [
  {
    step: "1",
    title: "Cadastro e acesso ao portal",
    description: "Voce cria sua conta de paciente e entra na plataforma em poucos minutos.",
  },
  {
    step: "2",
    title: "Escolha do horario",
    description: "No portal, voce escolhe profissional, data e horario disponivel para a consulta.",
  },
  {
    step: "3",
    title: "Pagamento online e confirmacao",
    description: "O pagamento e feito online pela propria plataforma e sua consulta fica confirmada automaticamente.",
  },
];

export function HowItWorksSection() {
  return (
    <Section id="atendimento">
      <Container>
        <SectionTitle
          eyebrow="Como funciona o atendimento"
          title="Um processo simples, humano e organizado"
          subtitle="Do cadastro ao pagamento online, todo o agendamento acontece pela plataforma com rapidez e seguranca."
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
