import {
  MERCADO_PAGO_RETURN_PARAM_KEYS,
  type MercadoPagoReturnParams,
} from "@/app/lib/mercado-pago-return-params";

type PaymentReturnDetailsProps = {
  params: MercadoPagoReturnParams;
};

const LABELS: Record<string, string> = {
  payment_id: "payment_id",
  status: "status",
  external_reference: "external_reference",
  merchant_order_id: "merchant_order_id",
  preference_id: "preference_id",
  payment_type: "payment_type",
};

export function PaymentReturnDetails({ params }: PaymentReturnDetailsProps) {
  return (
    <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Parâmetros da URL (teste)</h2>
      <p className="mt-1 text-xs text-slate-500">
        Valores enviados pelo Mercado Pago na query string ao redirecionar. Em produção, use webhooks para confirmar o
        pagamento.
      </p>
      <dl className="mt-4 space-y-2 text-sm">
        {MERCADO_PAGO_RETURN_PARAM_KEYS.map((key) => (
          <div key={key} className="flex flex-col gap-0.5 border-b border-slate-200/80 py-2 last:border-0 sm:flex-row sm:justify-between">
            <dt className="font-mono text-xs text-slate-500">{LABELS[key] ?? key}</dt>
            <dd className="break-all font-mono text-slate-900">{params[key] ?? "—"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
