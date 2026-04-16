import { SectionTitle } from "./SectionTitle";
import { Container, Section } from "../ui/SitePrimitives";

const team = [
  {
    name: "Dra. Mariana Alves",
    role: "Psicologa clinica - CRP 00/00000",
    focus: "Ansiedade, autoestima e autoconhecimento",
  },
  {
    name: "Dr. Rafael Monteiro",
    role: "Psicologo clinico - CRP 00/00000",
    focus: "Terapia de casal e relacionamentos",
  },
  {
    name: "Dra. Camila Nunes",
    role: "Psicologa clinica - CRP 00/00000",
    focus: "Adolescentes, orientacao familiar e estresse escolar",
  },
];

export function TeamSection() {
  return (
    <Section id="equipe" className="bg-white">
      <Container>
        <SectionTitle
          eyebrow="Equipe de psicologos"
          title="Profissionais experientes e comprometidos com seu bem-estar"
          subtitle="Nossa equipe atua com escuta tecnica, empatia e atualizacao constante para oferecer um atendimento de excelencia."
        />

        <div className="mt-8 grid gap-4 sm:mt-10 md:grid-cols-3">
          {team.map((member) => (
            <article
              key={member.name}
              className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm"
            >
              <h3 className="text-lg font-semibold text-slate-900">{member.name}</h3>
              <p className="mt-1 text-sm font-medium text-sky-700">{member.role}</p>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{member.focus}</p>
            </article>
          ))}
        </div>
      </Container>
    </Section>
  );
}
