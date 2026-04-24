import type { Metadata } from "next";
import Link from "next/link";

import { PaymentReturnDetails } from "@/app/components/payments/PaymentReturnDetails";
import { PaymentReturnDisclaimer } from "@/app/components/payments/PaymentReturnDisclaimer";
import { Container, Section } from "@/app/components/ui/SitePrimitives";
import { parseMercadoPagoReturnParamsFromRecord } from "@/app/lib/mercado-pago-return-params";

export const metadata: Metadata = {
  title: "Pagamento pendente",
  description: "Retorno do checkout Mercado Pago (pendente).",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PaymentPendingPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const params = parseMercadoPagoReturnParamsFromRecord(sp);

  return (
    <Section className="py-12 sm:py-16">
      <Container className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-800">Pagamento</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          Pagamento pendente. Caso tenha escolhido boleto ou outro meio offline, conclua o pagamento conforme as
          instruções do Mercado Pago.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Assim que o Mercado Pago confirmar o pagamento, seu pedido será atualizado (via integração no backend).
        </p>
        <PaymentReturnDetails params={params} />
        <PaymentReturnDisclaimer />
        <p className="mt-8">
          <Link
            href="/portal/consultas"
            className="text-sm font-semibold text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-900"
          >
            Ir para minhas consultas
          </Link>
        </p>
      </Container>
    </Section>
  );
}
