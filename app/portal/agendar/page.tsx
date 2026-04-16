import type { Metadata } from "next";
import { ScheduleConsultationBoard } from "@/app/components/portal/ScheduleConsultationBoard";

export const metadata: Metadata = {
  title: "Agendar consulta",
  description: "Ambiente mockado para escolha de psicologa e confirmacao de consulta.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PortalSchedulePage() {
  return <ScheduleConsultationBoard />;
}
