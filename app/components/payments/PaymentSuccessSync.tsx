"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { formatApiErrorDetail } from "@/app/lib/portal-errors";
import type { MercadoPagoReturnParams } from "@/app/lib/mercado-pago-return-params";

const ACCESS_TOKEN_KEY = "portal_access_token";

type SyncState =
  | { phase: "idle" | "loading" }
  | { phase: "done"; synced: boolean; alreadyRegistered: boolean; detail: string | null }
  | { phase: "error"; message: string };

type PaymentSuccessSyncProps = {
  initialParams: MercadoPagoReturnParams;
};

export function PaymentSuccessSync({ initialParams }: PaymentSuccessSyncProps) {
  const [state, setState] = useState<SyncState>({ phase: "idle" });

  useEffect(() => {
    const paymentId = initialParams.payment_id?.trim();
    if (!paymentId) {
      setState({
        phase: "done",
        synced: false,
        alreadyRegistered: false,
        detail:
          "Abra esta página pelo retorno do Mercado Pago (com payment_id na URL) ou confira em alguns instantes em Minhas consultas.",
      });
      return;
    }

    const token = typeof window !== "undefined" ? window.localStorage.getItem(ACCESS_TOKEN_KEY) : null;
    if (!token) {
      setState({
        phase: "done",
        synced: false,
        alreadyRegistered: false,
        detail:
          "Entre no portal do paciente na mesma conta em que agendou para registrar o pagamento automaticamente aqui.",
      });
      return;
    }

    let cancelled = false;
    setState({ phase: "loading" });

    void (async () => {
      try {
        const res = await fetch("/api/portal/patient/payments/mercadopago/sync-return", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ payment_id: paymentId }),
          cache: "no-store",
        });
        const data = (await res.json().catch(() => null)) as {
          synced?: boolean;
          already_registered?: boolean;
          detail?: unknown;
        } | null;

        if (cancelled) return;

        if (!res.ok || !data || typeof data !== "object") {
          setState({
            phase: "error",
            message: formatApiErrorDetail(
              data,
              res.status === 401
                ? "Sessão expirada. Entre novamente no portal e abra esta página outra vez."
                : "Não foi possível atualizar o registro no sistema.",
            ),
          });
          return;
        }

        const syncedOk = Boolean(data.synced);
        if (syncedOk && typeof window !== "undefined") {
          window.dispatchEvent(new Event("portal-billing-changed"));
        }

        setState({
          phase: "done",
          synced: syncedOk,
          alreadyRegistered: Boolean(data.already_registered),
          detail: typeof data.detail === "string" ? data.detail : null,
        });
      } catch {
        if (!cancelled) {
          setState({
            phase: "error",
            message: "Falha de rede ao sincronizar com o servidor. Tente atualizar a página.",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialParams.payment_id]);

  if (state.phase === "idle") {
    return null;
  }

  if (state.phase === "loading") {
    return (
      <p className="mt-4 rounded-xl border border-sky-200 bg-sky-50/90 px-4 py-3 text-sm text-sky-950" aria-live="polite">
        Registrando seu pagamento no sistema…
      </p>
    );
  }

  if (state.phase === "error") {
    return (
      <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm text-rose-900" role="alert">
        {state.message}
      </p>
    );
  }

  const { synced, alreadyRegistered, detail } = state;

  if (synced && !alreadyRegistered) {
    return (
      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-950">
        <p className="font-semibold">Tudo certo — sua consulta foi atualizada no sistema.</p>
        {detail ? <p className="mt-1 text-emerald-900/90">{detail}</p> : null}
        <p className="mt-3">
          <Link
            href="/portal/consultas"
            className="font-semibold text-emerald-900 underline decoration-emerald-400 underline-offset-2 hover:text-emerald-950"
          >
            Ir para minhas consultas
          </Link>
        </p>
      </div>
    );
  }

  if (synced && alreadyRegistered) {
    return (
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
        <p className="font-medium">{detail ?? "Pagamento já estava registrado."}</p>
        <p className="mt-3">
          <Link href="/portal/consultas" className="font-semibold text-sky-700 underline underline-offset-2 hover:text-sky-900">
            Ver minhas consultas
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
      <p className="font-medium">Ainda não foi possível marcar como pago no sistema.</p>
      {detail ? <p className="mt-2 text-amber-900/90">{detail}</p> : null}
      <p className="mt-3 text-xs text-amber-900/85">
        Se você acabou de pagar, aguarde alguns segundos (o Mercado Pago também notifica o servidor) ou entre no{" "}
        <Link href="/portal" className="font-semibold text-amber-950 underline underline-offset-2">
          portal do paciente
        </Link>{" "}
        e confira &quot;Minhas consultas&quot;.
      </p>
    </div>
  );
}
