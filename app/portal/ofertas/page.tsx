import type { Metadata } from "next";
import { OffersBoard } from "@/app/components/portal/OffersBoard";

export const metadata: Metadata = {
  title: "Ofertas",
  description: "Ambiente de ofertas de consulta com preco, psicologa e especialidade.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PortalOffersPage() {
  return <OffersBoard />;
}
