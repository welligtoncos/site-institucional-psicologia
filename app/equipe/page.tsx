import type { Metadata } from "next";
import { AppointmentCta } from "../components/internal/AppointmentCta";
import { PageHero } from "../components/internal/PageHero";
import { Container, Section } from "../components/ui/SitePrimitives";

const team = [
  {
    name: "Dra. Mariana Alves",
    role: "Psicologa clinica - CRP 00/00000",
    description:
      "Atua com ansiedade, autoestima e processos de autoconhecimento, com abordagem centrada na pessoa.",
  },
  {
    name: "Dr. Rafael Monteiro",
    role: "Psicologo clinico - CRP 00/00000",
    description:
      "Especialista em terapia de casal e relacionamentos, com foco em comunicacao e reconstrucao de vinculos.",
  },
  {
    name: "Dra. Camila Nunes",
    role: "Psicologa clinica - CRP 00/00000",
    description:
      "Atendimento para adolescentes e orientacao familiar, com experiencia em demandas escolares e emocionais.",
  },
  {
    name: "Dra. Patricia Lima",
    role: "Psicologa clinica - CRP 00/00000",
    description:
      "Trabalha com depressao, luto e reorganizacao de rotina, priorizando acolhimento e plano terapeutico claro.",
  },
];

export const metadata: Metadata = {
  title: "Equipe",
  description:
    "Conheca a equipe de psicologos da Clinica Harmonia e encontre o profissional ideal para seu momento.",
};

export default function EquipePage() {
  return (
    <>
      <PageHero
        eyebrow="Equipe"
        title="Conheca os psicologos da Clinica Harmonia"
        description="Profissionais qualificados, atualizados e comprometidos com um atendimento humano, etico e eficaz."
      />

      <Section>
        <Container className="grid gap-4 md:grid-cols-2">
          {team.map((member) => (
            <article key={member.name} className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">{member.name}</h2>
              <p className="mt-1 text-sm font-medium text-sky-700">{member.role}</p>
              <p className="mt-4 leading-relaxed text-slate-600">{member.description}</p>
            </article>
          ))}
        </Container>
      </Section>

      <AppointmentCta
        title="Escolha um atendimento alinhado ao seu momento"
        description="Nossa equipe esta preparada para receber voce com respeito, escuta e uma proposta terapeutica personalizada."
      />
    </>
  );
}
