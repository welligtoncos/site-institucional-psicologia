import type { Metadata } from "next";

import { PsychologistAuthShell } from "@/app/components/auth/PsychologistAuthShell";
import { PsychologistProfileForm } from "@/app/components/psicologo/PsychologistProfileForm";

export const metadata: Metadata = {
  title: "Perfil profissional",
  description: "CRP, biografia, valor, foto e especialidades (área do psicólogo).",
  robots: { index: false, follow: false },
};

export default function PsicologoPerfilPage() {
  return (
    <PsychologistAuthShell>
      <PsychologistProfileForm />
    </PsychologistAuthShell>
  );
}
