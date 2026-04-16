import { SectionTitle } from "./SectionTitle";
import { Container, Section } from "../ui/SitePrimitives";

const specialties = [
  "Ansiedade e estresse",
  "Depressao e luto",
  "Relacionamentos e conflitos afetivos",
  "Terapia de casal",
  "Orientacao para adolescentes",
  "Autoconhecimento e desenvolvimento pessoal",
];

export function SpecialtiesSection() {
  return (
    <Section id="especialidades" className="bg-white">
      <Container>
        <SectionTitle
          eyebrow="Especialidades atendidas"
          title="Atendimento clinico para diferentes momentos da vida"
          subtitle="Nossos psicologos atuam com abordagens atualizadas para apoiar demandas emocionais, comportamentais e relacionais."
        />

        <div className="mt-8 grid gap-4 sm:mt-10 sm:grid-cols-2 lg:grid-cols-3">
          {specialties.map((item) => (
            <article
              key={item}
              className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-slate-700 shadow-sm"
            >
              <p className="font-medium">{item}</p>
            </article>
          ))}
        </div>
      </Container>
    </Section>
  );
}
