import type { Metadata } from "next";
import { PortalGate } from "@/app/components/auth/PortalGate";
import { OffersBoard } from "@/app/components/portal/OffersBoard";

export const metadata: Metadata = {
  title: "Profissionais · Portal do paciente",
  description: "Profissionais ativos, especialidades, biografia e valor da consulta.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PortalOffersPage() {
  return (
    <PortalGate>
      <OffersBoard />
    </PortalGate>
  );
}
