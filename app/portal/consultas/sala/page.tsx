import type { Metadata } from "next";
import Link from "next/link";

import { PortalGate } from "@/app/components/auth/PortalGate";
import { PatientLiveSessionBoard } from "@/app/components/portal/PatientLiveSessionBoard";

export const metadata: Metadata = {
  title: "Sala de atendimento",
  description: "Entrada da sessão online do paciente.",
  robots: { index: false, follow: false },
};

type SalaPageProps = {
  searchParams: Promise<{ appointmentId?: string | string[] }>;
};

function normalizeAppointmentId(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export default async function PortalConsultasSalaPage({ searchParams }: SalaPageProps) {
  const sp = await searchParams;
  const appointmentId = normalizeAppointmentId(sp.appointmentId);

  return (
    <PortalGate>
      <div className="space-y-4">
        <Link href="/portal/consultas" className="inline-flex text-sm font-medium text-sky-700 underline">
          Voltar para Minhas consultas
        </Link>
        <PatientLiveSessionBoard autoOpenAppointmentId={appointmentId} />
      </div>
    </PortalGate>
  );
}
