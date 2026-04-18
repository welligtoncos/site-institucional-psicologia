import type { Metadata } from "next";
import { PortalGate } from "@/app/components/auth/PortalGate";
import { PatientPortalDashboard } from "@/app/components/portal/PatientPortalDashboard";

export const metadata: Metadata = {
  title: "Início · Portal do paciente",
  description:
    "Resumo da sua jornada na clínica: próxima consulta, finanças, atendimento online e cadastro, com acolhimento e clareza.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PortalPage() {
  return (
    <PortalGate>
      <PatientPortalDashboard />
    </PortalGate>
  );
}
