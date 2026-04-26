"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { listPatientAppointments, type ApiPatientAppointmentSummary } from "@/app/lib/portal-appointments-api";

function formatAppointmentDatePt(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatPriceBrl(price: string): string {
  const parsed = Number.parseFloat(price);
  if (!Number.isFinite(parsed)) return "0,00";
  return parsed.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function paymentStatusClass(payment: ApiPatientAppointmentSummary["payment"]): string {
  if (payment === "Pago") return "text-emerald-700";
  if (payment === "Pendente") return "text-amber-700";
  return "text-rose-700";
}

export function BillingInvoicesBoard() {
  const [appointments, setAppointments] = useState<ApiPatientAppointmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const refresh = useCallback(async () => {
    const from = new Date();
    from.setMonth(from.getMonth() - 6);
    const fromIso = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-${String(from.getDate()).padStart(2, "0")}`;
    const result = await listPatientAppointments(fromIso);
    if (result.ok) {
      setAppointments(result.data.appointments);
      setLoadError("");
      setLoading(false);
      return;
    }
    setAppointments([]);
    setLoadError(result.detail || "Não foi possível carregar o faturamento.");
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    function onStorage() {
      void refresh();
    }
    function onBilling() {
      void refresh();
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener("portal-billing-changed", onBilling);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("portal-billing-changed", onBilling);
    };
  }, [refresh]);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
        Carregando…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {loadError ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{loadError}</section>
      ) : null}

      <div>
        <h1 className="text-xl font-semibold text-slate-900">Histórico de pagamentos</h1>
        <p className="mt-1 text-sm text-slate-600">
          Nesta página você acompanha somente o status dos pagamentos das suas consultas.
        </p>
      </div>

      {/* Faturas */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Pagamentos das consultas</h2>
          <p className="text-xs text-slate-500">
            Últimos registros · {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </p>
        </div>
        {appointments.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            Nenhum registro de consulta ainda.{" "}
            <Link href="/portal/agendar" className="font-medium text-sky-700 underline">
              Agendar consulta
            </Link>
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-500">
                  <th className="px-4 py-2 font-medium">Data da consulta</th>
                  <th className="px-4 py-2 font-medium">Status do pagamento</th>
                  <th className="px-4 py-2 font-medium">Valor</th>
                </tr>
              </thead>
              <tbody className="text-slate-800">
                {appointments
                  .slice()
                  .sort((a, b) => `${b.iso_date} ${b.time}`.localeCompare(`${a.iso_date} ${a.time}`))
                  .map((apt) => {
                    const desc = `${formatAppointmentDatePt(apt.iso_date)} · ${apt.time}`;
                    return (
                      <tr key={apt.id} className="border-b border-slate-50">
                        <td className="max-w-[220px] px-4 py-3 text-xs">{desc}</td>
                        <td className="px-4 py-3">
                          <span className={paymentStatusClass(apt.payment)}>{apt.payment.toLowerCase()}</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">R$ {formatPriceBrl(apt.price)}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-center text-xs text-slate-500">
        Dúvidas sobre valores?{" "}
        <a href="mailto:contato@psicologoonlineja.com" className="font-medium text-sky-700 underline">
          Contato da clínica
        </a>
      </p>
    </div>
  );
}
