import type { Metadata } from "next";
import { AppointmentCta } from "../components/internal/AppointmentCta";
import { PageHero } from "../components/internal/PageHero";
import { Container, Section } from "../components/ui/SitePrimitives";

const specialties = [
  {
    title: "Ansiedade e estresse",
    description:
      "Acompanhamento para sintomas de ansiedade, sobrecarga emocional, preocupacao excessiva e dificuldade de relaxamento.",
  },
  {
    title: "Depressao e luto",
    description:
      "Atendimento cuidadoso para momentos de tristeza profunda, perdas significativas e reconstrucao de sentido.",
  },
  {
    title: "Relacionamentos",
    description:
      "Suporte para conflitos afetivos, comunicacao assertiva, limites saudaveis e fortalecimento de vinculos.",
  },
  {
    title: "Terapia de casal",
    description:
      "Espaco neutro e mediado para melhorar o dialogo, reduzir conflitos recorrentes e recuperar a parceria.",
  },
  {
    title: "Atendimento para adolescentes",
    description:
      "Apoio emocional para desafios escolares, sociais e familiares, com escuta especializada para essa fase.",
  },
  {
    title: "Autoconhecimento",
    description:
      "Processo terapeutico para ampliar consciencia emocional, fortalecer autoestima e desenvolver repertorio interno.",
  },
];

export const metadata: Metadata = {
  title: "Especialidades | Psicoterapia Online",
  description:
    "Veja as especialidades atendidas pelo Psicologo Online Ja: ansiedade, depressao, relacionamentos, terapia de casal e mais.",
  alternates: {
    canonical: "/especialidades",
  },
};

export default function EspecialidadesPage() {
  return (
    <>
      <PageHero
        eyebrow="Especialidades"
        title="Areas de atendimento do Psicologo Online Ja"
        description="Oferecemos suporte psicologico para diferentes demandas emocionais e relacionais, sempre com plano terapeutico individualizado."
      />

      <Section>
        <Container className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {specialties.map((item) => (
            <article key={item.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">{item.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.description}</p>
            </article>
          ))}
        </Container>
      </Section>

      <AppointmentCta
        title="Encontre o cuidado certo para voce"
        description="Nossa equipe pode orientar qual modalidade e profissional sao mais adequados para sua necessidade atual."
      />
    </>
  );
}
