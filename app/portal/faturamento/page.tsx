import type { Metadata } from "next";

import { BillingInvoicesBoard } from "@/app/components/portal/BillingInvoicesBoard";

export const metadata: Metadata = {
  title: "Faturamento e notas fiscais",
  description: "Cobranças, pagamentos e documentos fiscais (área do paciente).",
  robots: { index: false, follow: false },
};

export default function PortalFaturamentoPage() {
  return <BillingInvoicesBoard />;
}
