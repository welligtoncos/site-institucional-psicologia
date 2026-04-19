import type { Metadata } from "next";
import { Suspense } from "react";

import { PortalGate } from "@/app/components/auth/PortalGate";
import { ScheduleConsultationBoard } from "@/app/components/portal/ScheduleConsultationBoard";

export const metadata: Metadata = {
  title: "Agendar consulta",
  description: "Escolha data e horário conforme disponibilidade do profissional.",
  robots: {
    index: false,
    follow: false,
  },
};

function ScheduleFallback() {
  return (
    <div className="rounded-2xl border border-sky-100 bg-white p-8 text-center text-sm text-slate-600 shadow-sm">
      Carregando agendamento…
    </div>
  );
}

export default function PortalSchedulePage() {
  return (
    <PortalGate>
      <Suspense fallback={<ScheduleFallback />}>
        <ScheduleConsultationBoard />
      </Suspense>
    </PortalGate>
  );
}
