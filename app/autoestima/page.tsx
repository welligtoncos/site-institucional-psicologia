import type { Metadata } from "next";
import Link from "next/link";
import { AppointmentCta } from "../components/internal/AppointmentCta";
import { PageHero } from "../components/internal/PageHero";
import { Container, Section } from "../components/ui/SitePrimitives";

export const metadata: Metadata = {
  title: "Terapia para Autoestima e Autoconhecimento",
  description:
    "Terapia online para autoestima com foco em autoconhecimento, confianca e desenvolvimento emocional no dia a dia.",
  alternates: {
    canonical: "/autoestima",
  },
};

export default function AutoestimaPage() {
  return (
    <>
      <PageHero
        eyebrow="Autoestima"
        title="Psicologo online para fortalecer autoestima e confianca"
        description="Processo terapeutico para superar autocranca, inseguranca e padroes que limitam seu desenvolvimento pessoal e profissional."
      />
      <Section>
        <Container className="grid gap-6 md:grid-cols-2">
          <article className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Beneficios da terapia</h2>
            <p className="mt-3 leading-relaxed text-slate-600">
              Aumentar clareza sobre limites, melhorar relacoes, ampliar autoestima e tomar decisoes com mais
              seguranca e coerencia com seus valores.
            </p>
          </article>
          <article className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Para quem e indicado</h2>
            <p className="mt-3 leading-relaxed text-slate-600">
              Para quem enfrenta comparacoes frequentes, medo de julgamento, dificuldade de posicionamento e sensacao
              de nao ser suficiente.
            </p>
          </article>
        </Container>
        <Container className="mt-8">
          <p className="text-sm text-slate-600">
            Veja tambem:{" "}
            <Link href="/ansiedade" className="font-semibold text-sky-700 underline underline-offset-2">
              Terapia para ansiedade
            </Link>{" "}
            e{" "}
            <Link href="/terapia-de-casal" className="font-semibold text-sky-700 underline underline-offset-2">
              Terapia de casal
            </Link>
            .
          </p>
        </Container>
      </Section>
      <AppointmentCta
        title="Desenvolva sua autoestima com apoio profissional"
        description="Agende sua consulta e inicie um processo de autoconhecimento com objetivos claros e acompanhamento continuo."
      />
    </>
  );
}
