/**
 * Chamadas ao backend para preferências Mercado Pago (Checkout Pro / Wallet).
 * Credenciais sensíveis ficam só no servidor; aqui só public key no brick.
 */

import { getBackendApiUrl } from "@/app/lib/backend";
import { formatApiErrorDetail } from "@/app/lib/portal-errors";

export type MercadoPagoPreferenciaItem = {
  /** ID do pedido no seu sistema (vai em `external_reference` na preferência). */
  order_id?: number;
  title: string;
  quantity: number;
  unit_price: number;
};

export type MercadoPagoPreferenciaResult = {
  preference_id: string;
  init_point: string;
  sandbox_init_point: string | null;
};

export async function createMercadoPagoPreferencia(
  item: MercadoPagoPreferenciaItem,
): Promise<{ ok: true; data: MercadoPagoPreferenciaResult } | { ok: false; detail: string }> {
  const base = getBackendApiUrl().replace(/\/$/, "");
  const response = await fetch(`${base}/mercado-pago/preferencia`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item),
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as MercadoPagoPreferenciaResult | { detail?: unknown } | null;

  if (!response.ok || !data || typeof data !== "object") {
    const fallback =
      response.status === 502 || response.status === 503
        ? "Servidor ou Mercado Pago recusou a preferência. Veja o detalhe abaixo ou o Access Token no app_backend/.env."
        : "Não foi possível iniciar o pagamento. Tente novamente.";
    return {
      ok: false,
      detail: formatApiErrorDetail(data, fallback),
    };
  }

  if (!("preference_id" in data) || typeof data.preference_id !== "string") {
    return {
      ok: false,
      detail: formatApiErrorDetail(
        data,
        "Resposta sem preference_id. Confira MERCADO_PAGO_ACCESS_TOKEN (teste) e os logs do uvicorn.",
      ),
    };
  }
  return {
    ok: true,
    data: {
      preference_id: data.preference_id,
      init_point: typeof data.init_point === "string" ? data.init_point : "",
      sandbox_init_point: typeof data.sandbox_init_point === "string" ? data.sandbox_init_point : null,
    },
  };
}
