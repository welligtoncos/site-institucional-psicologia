import type { Metadata } from "next";
import Link from "next/link";

import { PaymentReturnDetails } from "@/app/components/payments/PaymentReturnDetails";
import { PaymentReturnDisclaimer } from "@/app/components/payments/PaymentReturnDisclaimer";
import { Container, Section } from "@/app/components/ui/SitePrimitives";
import { parseMercadoPagoReturnParamsFromRecord } from "@/app/lib/mercado-pago-return-params";

export const metadata: Metadata = {
  title: "Pagamento não concluído",
  description: "Retorno do checkout Mercado Pago (falha).",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PaymentFailurePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const params = parseMercadoPagoReturnParamsFromRecord(sp);

  return (
    <Section className="py-12 sm:py-16">
      <Container className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-rose-700">Pagamento</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          Pagamento recusado ou não concluído.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Não foi possível concluir a cobrança neste momento. Você pode tentar outro meio de pagamento ou revisar os
          dados no Mercado Pago.
        </p>
        <PaymentReturnDetails params={params} />
        <PaymentReturnDisclaimer />
        <p className="mt-8">
          <Link
            href="/portal/agendar"
            className="text-sm font-semibold text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-900"
          >
            Voltar ao agendamento
          </Link>
        </p>
      </Container>
    </Section>
  );
}
