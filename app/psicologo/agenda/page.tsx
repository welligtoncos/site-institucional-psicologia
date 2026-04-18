import type { Metadata } from "next";

import { PsychologistAuthShell } from "@/app/components/auth/PsychologistAuthShell";
import { PsychologistAgendaView } from "@/app/components/psicologo/PsychologistAgendaView";

export const metadata: Metadata = {
  title: "Agenda",
  description: "Consultas futuras, pendentes e horários bloqueados.",
  robots: { index: false, follow: false },
};

export default function PsicologoAgendaPage() {
  return (
    <PsychologistAuthShell>
      <PsychologistAgendaView />
    </PsychologistAuthShell>
  );
}
