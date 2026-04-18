import type { Metadata } from "next";

import { ScheduleConsultationBoard } from "@/app/components/portal/ScheduleConsultationBoard";

export const metadata: Metadata = {
  title: "Agendar consulta",
  description: "Escolha data e horário (demonstração).",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PortalSchedulePage() {
  return <ScheduleConsultationBoard />;
}
