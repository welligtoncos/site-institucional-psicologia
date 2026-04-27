import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

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

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export default async function PortalConsultasSalaPage({ searchParams }: SalaPageProps) {
  const sp = await searchParams;
  const rawAppointmentId = normalizeAppointmentId(sp.appointmentId)?.trim();
  const appointmentId = rawAppointmentId && isUuidLike(rawAppointmentId) ? rawAppointmentId : undefined;

  if (rawAppointmentId && !appointmentId) {
    redirect("/portal/consultas");
  }

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
