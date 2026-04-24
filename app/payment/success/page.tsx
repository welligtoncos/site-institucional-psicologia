import type { Metadata } from "next";
import Link from "next/link";

import { PaymentReturnDetails } from "@/app/components/payments/PaymentReturnDetails";
import { PaymentReturnDisclaimer } from "@/app/components/payments/PaymentReturnDisclaimer";
import { PaymentSuccessSync } from "@/app/components/payments/PaymentSuccessSync";
import { Container, Section } from "@/app/components/ui/SitePrimitives";
import { parseMercadoPagoReturnParamsFromRecord } from "@/app/lib/mercado-pago-return-params";

export const metadata: Metadata = {
  title: "Pagamento aprovado",
  description: "Retorno do checkout Mercado Pago (sucesso).",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PaymentSuccessPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const params = parseMercadoPagoReturnParamsFromRecord(sp);

  return (
    <Section className="py-12 sm:py-16">
      <Container className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Pagamento</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          Pronto! Seu pagamento já foi aprovado.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Obrigado. O Mercado Pago concluiu o checkout; abaixo registramos sua consulta no sistema quando você está
          logado no portal (na mesma conta em que agendou).
        </p>
        <PaymentSuccessSync initialParams={params} />
        <PaymentReturnDetails params={params} />
        <PaymentReturnDisclaimer />
        <p className="mt-8">
          <Link
            href="/portal/consultas"
            className="text-sm font-semibold text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-900"
          >
            Voltar às minhas consultas
          </Link>
        </p>
      </Container>
    </Section>
  );
}
