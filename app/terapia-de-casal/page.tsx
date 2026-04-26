import type { Metadata } from "next";
import Link from "next/link";
import { AppointmentCta } from "../components/internal/AppointmentCta";
import { PageHero } from "../components/internal/PageHero";
import { Container, Section } from "../components/ui/SitePrimitives";

export const metadata: Metadata = {
  title: "Terapia de Casal Online",
  description:
    "Terapia de casal online para melhorar comunicacao, resolver conflitos e fortalecer a parceria com mediacao profissional.",
  alternates: {
    canonical: "/terapia-de-casal",
  },
};

export default function TerapiaDeCasalPage() {
  return (
    <>
      <PageHero
        eyebrow="Terapia de casal"
        title="Atendimento para casais com foco em dialogo e reconstrucao"
        description="Espaco terapeutico neutro para organizar conflitos, melhorar a comunicacao e construir acordos mais saudaveis na relacao."
      />
      <Section>
        <Container className="grid gap-6 md:grid-cols-2">
          <article className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Demandas mais comuns</h2>
            <p className="mt-3 leading-relaxed text-slate-600">
              Ciumes, discussao recorrente, distancia emocional, dificuldade de escuta, divergencias sobre rotina e
              desgaste na convivencia.
            </p>
          </article>
          <article className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Objetivo da terapia</h2>
            <p className="mt-3 leading-relaxed text-slate-600">
              Criar um ambiente seguro para que ambos sejam ouvidos, com tecnicas para reduzir reatividade e recuperar
              colaboracao na relacao.
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
            <Link href="/depressao" className="font-semibold text-sky-700 underline underline-offset-2">
              Terapia para depressao
            </Link>
            .
          </p>
        </Container>
      </Section>
      <AppointmentCta
        title="Reconstruam o dialogo com apoio profissional"
        description="Agende a terapia de casal online para trabalhar conflitos com mediacao qualificada e foco em resultados concretos."
      />
    </>
  );
}
