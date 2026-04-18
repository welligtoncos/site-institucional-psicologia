import type { Metadata } from "next";

import { PsychologistAuthShell } from "@/app/components/auth/PsychologistAuthShell";
import { PsychologistInvoicesBoard } from "@/app/components/psicologo/PsychologistInvoicesBoard";

export const metadata: Metadata = {
  title: "Minhas consultas",
  robots: { index: false, follow: false },
};

export default function PsicologoFaturasPage() {
  return (
    <PsychologistAuthShell>
      <PsychologistInvoicesBoard />
    </PsychologistAuthShell>
  );
}
