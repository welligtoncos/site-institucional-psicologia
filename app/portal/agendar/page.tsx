import type { Metadata } from "next";
import { Suspense } from "react";

import { ScheduleConsultationBoard } from "@/app/components/portal/ScheduleConsultationBoard";

export const metadata: Metadata = {
  title: "Agendar consulta",
  description: "Ambiente mockado para escolha de psicólogo, data, horário e confirmação de consulta.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PortalSchedulePage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Carregando agenda…
        </div>
      }
    >
      <ScheduleConsultationBoard />
    </Suspense>
  );
}
