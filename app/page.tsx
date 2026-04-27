import type { Metadata } from "next";
import { ClinicPresentationSection } from "./components/home/ClinicPresentationSection";
import { DifferentialsSection } from "./components/home/DifferentialsSection";
import { FaqSection } from "./components/home/FaqSection";
import { HeroSection } from "./components/home/HeroSection";
import { HowItWorksSection } from "./components/home/HowItWorksSection";
import { SchedulingCtaSection } from "./components/home/SchedulingCtaSection";
import { SpecialtiesSection } from "./components/home/SpecialtiesSection";
import { TeamSection } from "./components/home/TeamSection";

export const metadata: Metadata = {
  title: "Psicologo Online | Terapia Online com Sigilo",
  description:
    "Psicologo online para ansiedade, estresse, relacionamentos e terapia de casal. Atendimento humanizado, sigiloso e agendamento rapido.",
  alternates: {
    canonical: "/",
  },
};

export default function Home() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Como funciona a terapia online?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Voce cria sua conta, escolhe o profissional e agenda o horario no portal. A sessao acontece em ambiente privado com orientacoes claras para acesso.",
        },
      },
      {
        "@type": "Question",
        name: "Qual e a duracao de cada sessao?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "As sessoes costumam durar em media 50 minutos, com frequencia definida conforme sua necessidade e recomendacao profissional.",
        },
      },
      {
        "@type": "Question",
        name: "As consultas online sao sigilosas?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Sim. O atendimento segue os principios eticos da psicologia, com sigilo profissional e boas praticas de privacidade em todo o processo.",
        },
      },
      {
        "@type": "Question",
        name: "Como e feito o pagamento?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "O pagamento e realizado online dentro da plataforma no momento do agendamento, com confirmacao automatica da consulta.",
        },
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <HeroSection />
      <ClinicPresentationSection />
      <SpecialtiesSection />
      <DifferentialsSection />
      <TeamSection />
      <HowItWorksSection />
      <FaqSection />
      <SchedulingCtaSection />
    </>
  );
}
