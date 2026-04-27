import type { Metadata } from "next";
import Image from "next/image";
import { AppointmentCta } from "../components/internal/AppointmentCta";
import { PageHero } from "../components/internal/PageHero";
import { Container, Section } from "../components/ui/SitePrimitives";

const team = [
  {
    name: "Barbara Reis Monteiro",
    role: "Psicologa Clinica - CRP 05/72363",
    photoSrc: "/barbara.jpg",
    photoAlt: "Foto de perfil da psicologa Barbara Reis Monteiro",
    summary:
      "Atendimento para criancas, adolescentes e adultos com foco em TDAH, neuroaprendizagem, autoestima e organizacao da rotina.",
    description:
      "Com escuta acolhedora e direcionamento pratico, Barbara ajuda voce a transformar sobrecarga em clareza e acao no dia a dia.",
    connectionPillars: ["Escuta acolhedora", "Direcionamento pratico", "Evolucao com consistencia"],
  },
];

export const metadata: Metadata = {
  title: "Sobre a Psicologa",
  description:
    "Conheca Barbara Reis Monteiro, psicologa clinica que atua no Psicologo Online Ja.",
  alternates: {
    canonical: "/equipe",
  },
};

export default function EquipePage() {
  return (
    <>
      <PageHero
        eyebrow="Equipe"
        title="Nossa equipe de psicologia"
        description="Hoje, a equipe e formada por Barbara Reis Monteiro, com atendimento acolhedor, etico e focado em resultados reais para o seu momento."
      />

      <Section>
        <Container className="grid gap-4">
          {team.map((member) => (
            <article key={member.name} className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
              <div className="flex flex-col gap-6 md:flex-row md:items-start">
                <div className="mx-auto w-full max-w-[220px] md:mx-0">
                  <div className="group aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                    <Image
                      src={member.photoSrc}
                      alt={member.photoAlt}
                      width={440}
                      height={440}
                      sizes="(max-width: 768px) 220px, 220px"
                      className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
                    />
                  </div>
                </div>

                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-slate-900">{member.name}</h2>
                  <p className="mt-1 text-sm font-medium text-sky-700">{member.role}</p>
                  <p className="mt-3 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-900">
                    Atendimento direto com a psicologa, com escuta proxima e plano terapeutico personalizado para voce.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {member.connectionPillars.map((pillar) => (
                      <span
                        key={pillar}
                        className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-800"
                      >
                        {pillar}
                      </span>
                    ))}
                  </div>
                  <p className="mt-4 leading-relaxed text-slate-700">{member.summary}</p>
                  <p className="mt-4 leading-relaxed text-slate-600">{member.description}</p>
                </div>
              </div>
            </article>
          ))}
        </Container>
      </Section>

      <AppointmentCta
        title="Agende seu atendimento com Barbara"
        description="Um espaco seguro, humano e profissional para voce cuidar da sua saude emocional com acompanhamento de perto."
      />
    </>
  );
}
