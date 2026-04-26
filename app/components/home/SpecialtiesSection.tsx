import Link from "next/link";
import { SectionTitle } from "./SectionTitle";
import { Container, Section } from "../ui/SitePrimitives";

const specialties = [
  { label: "Ansiedade e estresse", href: "/ansiedade" },
  { label: "Depressao e luto", href: "/depressao" },
  { label: "Relacionamentos e conflitos afetivos", href: "/terapia-de-casal" },
  { label: "Terapia de casal", href: "/terapia-de-casal" },
  { label: "Orientacao para adolescentes", href: "/especialidades" },
  { label: "Autoconhecimento e desenvolvimento pessoal", href: "/autoestima" },
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
              key={item.label}
              className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-slate-700 shadow-sm"
            >
              <Link href={item.href} className="font-medium transition hover:text-sky-700">
                {item.label}
              </Link>
            </article>
          ))}
        </div>
      </Container>
    </Section>
  );
}
