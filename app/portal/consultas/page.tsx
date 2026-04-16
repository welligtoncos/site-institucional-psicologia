import type { Metadata } from "next";
import { AppointmentsBoard } from "@/app/components/portal/AppointmentsBoard";

export const metadata: Metadata = {
  title: "Consultas agendadas",
  description: "Ambiente para verificar consultas agendadas do paciente.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PortalAppointmentsPage() {
  return <AppointmentsBoard />;
}
