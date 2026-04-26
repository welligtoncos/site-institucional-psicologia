import { SectionTitle } from "./SectionTitle";
import { Container, Section } from "../ui/SitePrimitives";

const differentials = [
  {
    title: "Atendimento personalizado",
    description: "Cada paciente conta com um plano terapeutico adequado ao seu contexto e objetivos.",
  },
  {
    title: "Equipe multidisciplinar",
    description: "Profissionais com diferentes especializacoes para oferecer suporte integrado.",
  },
  {
    title: "Presencial e online",
    description: "Flexibilidade para realizar consultas com conforto e continuidade do cuidado.",
  },
];

export function DifferentialsSection() {
  return (
    <Section>
      <Container>
        <SectionTitle
          eyebrow="Diferenciais"
          title="Por que escolher o Psicologo Online Ja"
          subtitle="Combinamos ciencia, acolhimento e experiencia clinica para oferecer um cuidado emocional consistente e confiavel."
          align="center"
        />

        <div className="mt-8 grid gap-4 sm:mt-10 md:grid-cols-3">
          {differentials.map((item) => (
            <article key={item.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.description}</p>
            </article>
          ))}
        </div>
      </Container>
    </Section>
  );
}
