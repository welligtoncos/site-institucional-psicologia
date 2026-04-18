import type { Metadata } from "next";
import { AppointmentsBoard } from "@/app/components/portal/AppointmentsBoard";

export const metadata: Metadata = {
  title: "Minhas consultas",
  description: "Próximas sessões, histórico, cancelamento e remarcação (demonstração no navegador).",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PortalAppointmentsPage() {
  return <AppointmentsBoard />;
}
