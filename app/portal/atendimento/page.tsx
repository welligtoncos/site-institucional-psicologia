import type { Metadata } from "next";

import { PortalGate } from "@/app/components/auth/PortalGate";
import { PatientLiveSessionBoard } from "@/app/components/portal/PatientLiveSessionBoard";

export const metadata: Metadata = {
  title: "Atendimento ao vivo",
  description: "Entrar na sala de espera e acompanhar a sessão em tempo real (demonstração).",
  robots: { index: false, follow: false },
};

export default function PortalAtendimentoPage() {
  return (
    <PortalGate>
      <PatientLiveSessionBoard />
    </PortalGate>
  );
}
