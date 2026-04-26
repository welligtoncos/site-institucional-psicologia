"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { listPatientAppointments, type ApiPatientAppointmentSummary } from "@/app/lib/portal-appointments-api";

function formatDateShort(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

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

  const monthCtx = useMemo(() => {
    const start = new Date();
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    return {
      label: `${start.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })} – ${end.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`,
      monthKey: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
    };
  }, []);

  const consultasNoMes = useMemo(() => {
    const prefix = monthCtx.monthKey.slice(0, 7);
    return appointments.filter((a) => a.iso_date.startsWith(prefix));
  }, [appointments, monthCtx.monthKey]);

  const sessoesRealizadas = useMemo(
    () => appointments.filter((a) => a.status === "realizada").length,
    [appointments],
  );

  const totalPendente = useMemo(() => {
    return appointments
      .filter((a) => a.payment === "Pendente")
      .reduce((sum, a) => sum + (Number.parseFloat(a.price) || 0), 0);
  }, [appointments]);

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
        <h1 className="text-xl font-semibold text-slate-900">Faturamento e notas fiscais</h1>
        <p className="mt-1 text-sm text-slate-600">Resumo de pagamentos e situação das suas consultas.</p>
      </div>

      {/* Faturas */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Consultas e pagamentos</h2>
          <p className="text-xs text-slate-500">
            Histórico de pagamentos · {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
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
                  <th className="px-4 py-2 font-medium">Data</th>
                  <th className="px-4 py-2 font-medium">Consulta</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Valor</th>
                  <th className="px-4 py-2 font-medium">Profissional</th>
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
                        <td className="whitespace-nowrap px-4 py-3 text-xs">{formatDateShort(apt.iso_date)}</td>
                        <td className="max-w-[180px] px-4 py-3 text-xs">{desc}</td>
                        <td className="px-4 py-3">
                          <span className={paymentStatusClass(apt.payment)}>{apt.payment.toLowerCase()}</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">R$ {formatPriceBrl(apt.price)}</td>
                        <td className="px-4 py-3 text-xs text-slate-600">{apt.psychologist_name}</td>
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
