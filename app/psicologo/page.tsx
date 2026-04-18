import type { Metadata } from "next";

import { PsychologistGate } from "@/app/components/auth/PsychologistGate";

export const metadata: Metadata = {
  title: "Painel do psicólogo",
  description: "Agenda e ferramentas para profissionais da clínica.",
  robots: { index: false, follow: false },
};

export default function PsicologoHomePage() {
  return <PsychologistGate />;
}
