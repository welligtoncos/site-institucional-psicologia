import type { Metadata } from "next";

import { PsychologistAuthShell } from "@/app/components/auth/PsychologistAuthShell";
import { PsychologistAvailabilityBoard } from "@/app/components/psicologo/PsychologistAvailabilityBoard";

export const metadata: Metadata = {
  title: "Abrir agenda",
  description: "Defina horários de atendimento e bloqueios da agenda (área do psicólogo).",
  robots: { index: false, follow: false },
};

export default function PsicologoDisponibilidadePage() {
  return (
    <PsychologistAuthShell>
      <PsychologistAvailabilityBoard />
    </PsychologistAuthShell>
  );
}
