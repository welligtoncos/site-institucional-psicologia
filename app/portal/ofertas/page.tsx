import type { Metadata } from "next";
import { OffersBoard } from "@/app/components/portal/OffersBoard";

export const metadata: Metadata = {
  title: "Psicólogos",
  description: "Lista de psicólogos ativos com especialidades, biografia e valor da consulta (demonstração).",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PortalOffersPage() {
  return <OffersBoard />;
}
