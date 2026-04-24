import type { Metadata } from "next";

import { PsychologistGate } from "@/app/components/auth/PsychologistGate";

export const metadata: Metadata = {
  title: "Início · Painel do psicólogo",
  description:
    "Resumo da sua rotina: próximo atendimento, agenda, atendimento online e finanças, com o mesmo acolhimento visual do portal do paciente.",
  robots: { index: false, follow: false },
};

export default function PsicologoHomePage() {
  return <PsychologistGate />;
}
