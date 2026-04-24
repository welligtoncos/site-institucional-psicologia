"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { MOCK_PSYCHOLOGIST, formatAppointmentDatePt, type MockAppointment } from "@/app/lib/portal-mocks";
import {
  getAllPaymentCharges,
  getPatientAppointments,
  type MockPaymentCharge,
} from "@/app/lib/portal-payment-mock";

function formatMoneyBrl(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function chargeStatusInvoice(c: MockPaymentCharge): string {
  if (c.gatewayStatus === "succeeded") return "Pago";
  if (c.gatewayStatus === "failed") return "Falhou";
  return "Pendente";
}

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

export function BillingInvoicesBoard() {
  const [charges, setCharges] = useState<MockPaymentCharge[]>([]);
  const [appointments, setAppointments] = useState<MockAppointment[]>([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(() => {
    setCharges(getAllPaymentCharges());
    setAppointments(getPatientAppointments());
  }, []);

  useEffect(() => {
    refresh();
    setReady(true);
    function onStorage() {
      refresh();
    }
    function onBilling() {
      refresh();
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener("portal-billing-changed", onBilling);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("portal-billing-changed", onBilling);
    };
  }, [refresh]);

  const byAppointmentId = useMemo(() => {
    const m = new Map<string, MockAppointment>();
    appointments.forEach((a) => m.set(a.id, a));
    return m;
  }, [appointments]);

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
    return appointments.filter((a) => a.isoDate.startsWith(prefix));
  }, [appointments, monthCtx.monthKey]);

  const sessoesRealizadas = useMemo(
    () => appointments.filter((a) => a.status === "realizada").length,
    [appointments],
  );

  const totalPendente = useMemo(() => {
    return charges.filter((c) => c.gatewayStatus === "awaiting_payment").reduce((s, c) => s + c.amountCents, 0);
  }, [charges]);

  function demoToast(msg: string) {
    toast.message(msg);
  }

  if (!ready) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
        Carregando…
      </div>
    );
  }

  const priceSession = MOCK_PSYCHOLOGIST.price;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="rounded-xl border border-sky-100 bg-sky-50/70 px-4 py-3 text-sm text-slate-800">
        <strong className="font-semibold">Pagamento por consulta:</strong> não há mensalidade nem cobrança automática
        recorrente. Cada sessão gera uma cobrança no valor vigente à época do agendamento.
      </div>

      <div>
        <h1 className="text-xl font-semibold text-slate-900">Faturamento e notas fiscais</h1>
        <p className="mt-1 text-sm text-slate-600">
          Valor da sessão, pagamentos e faturas (demonstração no navegador).
        </p>
      </div>

      {/* Valor por consulta */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Valor da consulta</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-lg font-semibold text-slate-900">R$ {priceSession.toFixed(2).replace(".", ",")} por sessão</p>
            <p className="mt-1 text-sm text-slate-600">
              Referência: {MOCK_PSYCHOLOGIST.name}. O valor pode ser atualizado pela clínica; cada agendamento gera sua
              própria cobrança.
            </p>
          </div>
        </div>
      </section>

      {/* Pagamento (cartão / gateway) */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Forma de pagamento</h2>
        <p className="mt-1 text-sm text-slate-600">
          Cadastro usado quando você paga uma consulta pelo gateway (cartão, PIX etc.). Não há débito automático mensal.
        </p>
        <button
          type="button"
          onClick={() => demoToast("Demonstração: abrir o gateway para atualizar cartão ou PIX salvo.")}
          className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          Gerenciar no gateway
        </button>
        {totalPendente > 0 ? (
          <p className="mt-3 text-sm text-amber-800">
            Há cobrança em aberto: <strong>R$ {formatMoneyBrl(totalPendente)}</strong>. Regularize em{" "}
            <Link href="/portal/consultas" className="font-semibold underline">
              Consultas
            </Link>{" "}
            ou pague pela fatura abaixo.
          </p>
        ) : null}
      </section>

      {/* Resumo do mês (informativo) */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Resumo do período</h2>
          <p className="text-xs text-slate-500">{monthCtx.label}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[320px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-500">
                <th className="px-5 py-2 font-medium">Item</th>
                <th className="px-5 py-2 font-medium">Quantidade</th>
                <th className="px-5 py-2 font-medium">Obs.</th>
              </tr>
            </thead>
            <tbody className="text-slate-800">
              <tr className="border-b border-slate-50">
                <td className="px-5 py-3">Consultas neste mês (agendadas)</td>
                <td className="px-5 py-3">{consultasNoMes.length}</td>
                <td className="px-5 py-3 text-slate-600">Apenas informativo</td>
              </tr>
              <tr className="border-b border-slate-50">
                <td className="px-5 py-3">Sessões já realizadas (total)</td>
                <td className="px-5 py-3">{sessoesRealizadas}</td>
                <td className="px-5 py-3 text-slate-600">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Faturas */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Faturas</h2>
          <p className="text-xs text-slate-500">
            Uma fatura por consulta agendada · {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </p>
        </div>
        {charges.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            Nenhuma fatura ainda.{" "}
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
                  <th className="px-4 py-2 font-medium">Descrição</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Valor</th>
                  <th className="px-4 py-2 font-medium">Fatura</th>
                  <th className="px-4 py-2 font-medium" />
                </tr>
              </thead>
              <tbody className="text-slate-800">
                {charges
                  .slice()
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                  .map((c) => {
                    const apt = byAppointmentId.get(c.appointmentId);
                    const desc = apt
                      ? `Consulta · ${formatAppointmentDatePt(apt.isoDate)}`
                      : `Consulta #${c.appointmentId}`;
                    return (
                      <tr key={c.id} className="border-b border-slate-50">
                        <td className="whitespace-nowrap px-4 py-3 text-xs">{formatDateShort(c.createdAt)}</td>
                        <td className="max-w-[180px] px-4 py-3 text-xs">{desc}</td>
                        <td className="px-4 py-3">
                          <span
                            className={
                              c.gatewayStatus === "succeeded"
                                ? "text-emerald-700"
                                : c.gatewayStatus === "failed"
                                  ? "text-rose-700"
                                  : "text-amber-700"
                            }
                          >
                            {chargeStatusInvoice(c).toLowerCase()}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">R$ {formatMoneyBrl(c.amountCents)}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">{c.id}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => demoToast("Demonstração: abrir PDF da fatura ou página do gateway.")}
                            className="text-xs font-semibold text-sky-700 hover:underline"
                          >
                            Ver
                          </button>
                        </td>
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
        <a href="mailto:contato@clinicaharmonia.com.br" className="font-medium text-sky-700 underline">
          Contato da clínica
        </a>
      </p>
    </div>
  );
}
