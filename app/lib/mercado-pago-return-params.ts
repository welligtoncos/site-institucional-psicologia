/**
 * Parâmetros que o Mercado Pago pode enviar nas back_urls (query string).
 * Útil para UX e testes; a confirmação oficial do pagamento deve vir de webhooks.
 */

export const MERCADO_PAGO_RETURN_PARAM_KEYS = [
  "payment_id",
  "status",
  "external_reference",
  "merchant_order_id",
  "preference_id",
  "payment_type",
] as const;

export type MercadoPagoReturnParamKey = (typeof MERCADO_PAGO_RETURN_PARAM_KEYS)[number];

export type MercadoPagoReturnParams = Partial<Record<MercadoPagoReturnParamKey, string>>;

function firstString(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

/** A partir do objeto `searchParams` do Next.js (App Router). */
export function parseMercadoPagoReturnParamsFromRecord(
  sp: Record<string, string | string[] | undefined>,
): MercadoPagoReturnParams {
  const out: MercadoPagoReturnParams = {};
  for (const key of MERCADO_PAGO_RETURN_PARAM_KEYS) {
    const v = firstString(sp[key]);
    if (v !== undefined) out[key] = v;
  }
  return out;
}

/**
 * A partir de `window.location.search` ou string equivalente.
 *
 * @example
 * const params = new URLSearchParams(window.location.search);
 * const paymentId = params.get("payment_id");
 * // … ou use parseMercadoPagoReturnParamsFromSearch(window.location.search)
 */
export function parseMercadoPagoReturnParamsFromSearch(search: string): MercadoPagoReturnParams {
  const qs = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  const out: MercadoPagoReturnParams = {};
  for (const key of MERCADO_PAGO_RETURN_PARAM_KEYS) {
    const v = qs.get(key);
    if (v !== null && v.length > 0) out[key] = v;
  }
  return out;
}
