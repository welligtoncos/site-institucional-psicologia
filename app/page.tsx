import type { Metadata } from "next";
import { ClinicPresentationSection } from "./components/home/ClinicPresentationSection";
import { DifferentialsSection } from "./components/home/DifferentialsSection";
import { HeroSection } from "./components/home/HeroSection";
import { HowItWorksSection } from "./components/home/HowItWorksSection";
import { SchedulingCtaSection } from "./components/home/SchedulingCtaSection";
import { SpecialtiesSection } from "./components/home/SpecialtiesSection";
import { TeamSection } from "./components/home/TeamSection";

export const metadata: Metadata = {
  title: "Home",
  description:
    "Clinica de psicologia com atendimento humanizado, equipe qualificada e suporte emocional para diferentes fases da vida.",
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
