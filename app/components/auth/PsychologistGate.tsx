"use client";

import { PsychologistAuthShell } from "@/app/components/auth/PsychologistAuthShell";
import { PsychologistDashboard } from "@/app/components/auth/PsychologistDashboard";

/** Painel principal do portal do psicólogo (autenticação + dashboard). */
export function PsychologistGate() {
  return (
    <PsychologistAuthShell>
      <PsychologistDashboard />
    </PsychologistAuthShell>
  );
}
