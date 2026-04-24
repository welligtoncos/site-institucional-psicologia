"use client";

/**
 * Mesmo fluxo da documentação do Mercado Pago (@mercadopago/sdk-react):
 *
 * ```tsx
 * initMercadoPago('YOUR_PUBLIC_KEY');
 * <Wallet initialization={{ preferenceId: 'YOUR_PREFERENCE_ID' }} />
 * ```
 *
 * Aqui:
 * - Public Key → `process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY` (nunca commitar valor real).
 * - `preferenceId` → retornado pelo backend (`POST /mercado-pago/preferencia`), não fixo no código.
 * - `Wallet` é carregado com `next/dynamic` e `ssr: false` para o SDK não rodar no servidor (Next.js).
 */

import dynamic from "next/dynamic";
import { initMercadoPago } from "@mercadopago/sdk-react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { createMercadoPagoPreferencia, type MercadoPagoPreferenciaItem } from "@/app/lib/mercado-pago-preferences-api";

const Wallet = dynamic(
  async () => (await import("@mercadopago/sdk-react")).Wallet,
  {
    ssr: false,
    loading: () => (
      <p className="py-3 text-center text-sm text-slate-600" aria-live="polite">
        Carregando botão do Mercado Pago…
      </p>
    ),
  },
);

export type MercadoPagoCheckoutProduct = MercadoPagoPreferenciaItem;

type MercadoPagoCheckoutProps = {
  /** Dados do item (no futuro: derivar do carrinho ou da consulta). */
  product: MercadoPagoCheckoutProduct;
  /** Opcional: enviado ao backend como `order_id` / `external_reference`. */
  orderId?: number;
};

type LoadState = "idle" | "loading" | "ready" | "error";

function getPublicKey(): string {
  const raw = process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY ?? "";
  return raw.trim().replace(/\s+/g, "");
}

export function MercadoPagoCheckout({ product, orderId }: MercadoPagoCheckoutProps) {
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [preferenceId, setPreferenceId] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const initOnce = useRef(false);

  const publicKey = getPublicKey();

  useLayoutEffect(() => {
    if (!publicKey) return;
    if (!initOnce.current) {
      initMercadoPago(publicKey);
      initOnce.current = true;
    }
  }, [publicKey]);

  const handleComprarAgora = useCallback(async () => {
    setLoadState("loading");
    setPreferenceId(null);
    setErrorDetail(null);
    const result = await createMercadoPagoPreferencia({
      ...product,
      ...(orderId !== undefined ? { order_id: orderId } : {}),
    });
    if (!result.ok) {
      setErrorDetail(result.detail);
      setLoadState("error");
      return;
    }
    initMercadoPago(publicKey);
    setPreferenceId(result.data.preference_id);
    setLoadState("ready");
  }, [product, orderId, publicKey]);

  if (!publicKey) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-950">
        <p className="font-semibold text-amber-950">Sem chave pública — o botão do Mercado Pago não pode aparecer</p>
        <p className="mt-2 text-xs leading-relaxed text-amber-900/90">
          O Next.js <strong className="font-semibold">não lê</strong>{" "}
          <code className="rounded bg-amber-100 px-1 font-mono text-[11px]">app_backend/.env</code>. Coloque a Public
          Key em <code className="rounded bg-amber-100 px-1 font-mono text-[11px]">.env.local</code> na{" "}
          <strong className="font-semibold">raiz do repositório</strong> (mesma pasta que{" "}
          <code className="rounded bg-amber-100 px-1">package.json</code>), assim:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-amber-100/80 p-3 font-mono text-[11px] leading-relaxed text-amber-950 ring-1 ring-amber-200/80">
          NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY=APP_USR_sua_public_key_aqui
        </pre>
        <p className="mt-2 text-xs leading-relaxed text-amber-900/90">
          Sem espaço depois do <code className="rounded bg-amber-100 px-1">=</code>. O{" "}
          <code className="rounded bg-amber-100 px-1">MERCADO_PAGO_ACCESS_TOKEN</code> continua só no{" "}
          <code className="rounded bg-amber-100 px-1">app_backend/.env</code>.
        </p>
        <p className="mt-3 text-xs leading-relaxed text-amber-900/90">
          Salve e <strong className="font-semibold">reinicie</strong>{" "}
          <code className="rounded bg-amber-100 px-1">npm run dev</code> (variáveis{" "}
          <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_*</code> só entram ao subir o servidor).
        </p>
        <p className="mt-2 text-xs text-amber-800/90">
          Obter chave:{" "}
          <a
            href="https://www.mercadopago.com.br/developers/panel/app"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-amber-950 underline underline-offset-2 hover:text-amber-900"
          >
            Mercado Pago → Suas integrações → Credenciais de teste
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-sky-200/80 bg-white/90 p-4 ring-1 ring-sky-100">
      <div>
        <p className="text-sm font-semibold text-slate-900">Pagar com Mercado Pago (sandbox)</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          Clique em <strong className="font-semibold text-slate-800">Comprar agora</strong> para criar a preferência no
          servidor; em seguida aparece o botão do Mercado Pago para ir ao checkout.
        </p>
      </div>

      {loadState === "idle" || loadState === "error" ? (
        <button
          type="button"
          onClick={() => void handleComprarAgora()}
          className="w-full rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
        >
          Comprar agora
        </button>
      ) : null}

      {loadState === "loading" ? (
        <p className="text-center text-sm font-medium text-slate-600" aria-live="polite">
          Gerando pagamento...
        </p>
      ) : null}

      {loadState === "error" ? (
        <p className="text-center text-sm leading-relaxed text-rose-800" role="alert">
          {errorDetail ??
            "Não foi possível iniciar o pagamento. Tente novamente — confira Access Token (backend) e Public Key (Next)."}
        </p>
      ) : null}

      {preferenceId && loadState === "ready" ? (
        <div className="mx-auto flex w-full max-w-[300px] flex-col items-center pt-1">
          <Wallet
            initialization={{ preferenceId, redirectMode: "blank" }}
            locale="pt-BR"
            onError={(err) => {
              console.error("Mercado Pago Wallet:", err);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
