import type { Metadata } from "next";

import { PsychologistAuthShell } from "@/app/components/auth/PsychologistAuthShell";
import { PsychologistLiveSessionBoard } from "@/app/components/psicologo/PsychologistLiveSessionBoard";

export const metadata: Metadata = {
  title: "Iniciar sessão",
  robots: { index: false, follow: false },
};

export default function PsicologoSessaoPage() {
  return (
    <PsychologistAuthShell>
      <PsychologistLiveSessionBoard />
    </PsychologistAuthShell>
  );
}
