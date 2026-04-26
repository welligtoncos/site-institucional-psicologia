import type { Metadata } from "next";

import { BillingInvoicesBoard } from "@/app/components/portal/BillingInvoicesBoard";

export const metadata: Metadata = {
  title: "Histórico de pagamentos",
  description: "Acompanhe o histórico e o status dos pagamentos das suas consultas.",
  robots: { index: false, follow: false },
};

export default function PortalFaturamentoPage() {
  return <BillingInvoicesBoard />;
}
