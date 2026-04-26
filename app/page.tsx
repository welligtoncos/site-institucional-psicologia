import type { Metadata } from "next";
import { ClinicPresentationSection } from "./components/home/ClinicPresentationSection";
import { DifferentialsSection } from "./components/home/DifferentialsSection";
import { HeroSection } from "./components/home/HeroSection";
import { HowItWorksSection } from "./components/home/HowItWorksSection";
import { SchedulingCtaSection } from "./components/home/SchedulingCtaSection";
import { SpecialtiesSection } from "./components/home/SpecialtiesSection";
import { TeamSection } from "./components/home/TeamSection";

export const metadata: Metadata = {
  title: "Psicologo Online | Terapia Online com Sigilo",
  description:
    "Psicologo online para ansiedade, estresse, relacionamentos e terapia de casal. Atendimento humanizado e agendamento rapido.",
  alternates: {
    canonical: "/",
  },
};

export default function Home() {
  return (
    <>
      <HeroSection />
      <ClinicPresentationSection />
      <SpecialtiesSection />
      <DifferentialsSection />
      <TeamSection />
      <HowItWorksSection />
      <SchedulingCtaSection />
    </>
  );
}
