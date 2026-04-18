"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  MOCK_PSYCHOLOGIST,
  mockSlotsForDate,
  nextDates,
  type MockAppointment,
} from "@/app/lib/portal-mocks";
import {
  appendAppointment,
  createChargeForAppointment,
  registerGatewayPaymentSuccess,
  type MockPaymentCharge,
} from "@/app/lib/portal-payment-mock";

function formatDateLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
}

export function ScheduleConsultationBoard() {
  const psych = MOCK_PSYCHOLOGIST;

  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastCharge, setLastCharge] = useState<MockPaymentCharge | null>(null);

  const dateOptions = useMemo(() => nextDates(new Date(), 7), []);

  useEffect(() => {
    if (!selectedDate && dateOptions.length > 0) {
      setSelectedDate(dateOptions[0]!);
    }
  }, [dateOptions, selectedDate]);

  const slotsForDay = useMemo(() => {
    if (!selectedDate) return [];
    return mockSlotsForDate(psych.id, selectedDate);
  }, [psych.id, selectedDate]);

  function handleConfirm() {
    if (!selectedDate || !selectedTime) {
      toast.error("Escolha data e horário.");
      return;
    }
    setSubmitting(true);
    window.setTimeout(() => {
      const id = `apt_${Date.now()}`;
      const appointment: MockAppointment = {
        id,
        psychId: psych.id,
        psychologist: psych.name,
        specialty: psych.specialties[0] ?? "Consulta",
        isoDate: selectedDate,
        time: selectedTime,
        format: "Online",
        price: psych.price,
        durationMin: psych.durationMin,
        payment: "Pendente",
        status: "agendada",
        reminder: "Cobrança gerada. Conclua o pagamento para confirmar.",
      };
      appendAppointment(appointment);
      const charge = createChargeForAppointment(id, psych.price);
      setLastCharge(charge);
      setSubmitting(false);
      toast.success("Consulta criada. Cobrança registrada (RF-009 — mock).");
    }, 400);
  }

  function handleSimulateGateway() {
    if (!lastCharge) return;
    const result = registerGatewayPaymentSuccess(lastCharge.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setLastCharge(result.charge);
    toast.success("Pagamento registrado (RF-010 — retorno do gateway simulado).");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-sky-100 bg-gradient-to-r from-sky-50 to-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Agendar</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Nova consulta</h1>
        <p className="mt-2 text-sm text-slate-600">
          Após confirmar, o sistema gera a cobrança e prepara o vínculo com o gateway de pagamento (demonstração).
        </p>
      </section>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex sm:items-center sm:gap-4">
        <div
          className={`mx-auto flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${psych.avatarClass} text-sm font-bold text-white sm:mx-0`}
        >
          {psych.initials}
        </div>
        <div className="mt-3 text-center sm:mt-0 sm:text-left">
          <p className="font-semibold text-slate-900">{psych.name}</p>
          <p className="text-xs text-slate-500">R$ {psych.price.toFixed(2).replace(".", ",")} · {psych.durationMin} min</p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">Data</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {dateOptions.map((iso) => (
            <button
              key={iso}
              type="button"
              onClick={() => {
                setSelectedDate(iso);
                setSelectedTime("");
              }}
              className={`rounded-xl border px-3 py-2 text-left text-xs transition ${
                selectedDate === iso ? "border-sky-400 bg-sky-50 font-semibold text-sky-900" : "border-slate-200 text-slate-700"
              }`}
            >
              {formatDateLabel(iso)}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">Horário</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {slotsForDay.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setSelectedTime(t)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                selectedTime === t ? "border-sky-400 bg-sky-50 text-sky-900" : "border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-700">
          <span className="font-semibold text-slate-900">Resumo:</span>{" "}
          {selectedDate && selectedTime
            ? `${formatDateLabel(selectedDate)} às ${selectedTime}`
            : "Selecione data e horário."}
        </p>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={submitting || !selectedDate || !selectedTime}
          className="mt-4 w-full rounded-full bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Gerando consulta e cobrança…" : "Confirmar e gerar cobrança"}
        </button>
      </section>

      {lastCharge ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/80 p-5 shadow-sm">
          <p className="text-sm font-semibold text-amber-950">Pagamento</p>
          <p className="mt-1 text-xs text-amber-900/90">
            Integração futura: o gateway receberá o <code className="rounded bg-white/80 px-1">{lastCharge.gatewayIntentId}</code> para
            checkout real.
          </p>
          <dl className="mt-3 space-y-1 text-xs text-amber-950">
            <div>
              <dt className="inline text-amber-800">Cobrança:</dt>{" "}
              <dd className="inline font-mono">{lastCharge.id}</dd>
            </div>
            <div>
              <dt className="inline text-amber-800">Valor:</dt>{" "}
              <dd className="inline">
                R$ {(lastCharge.amountCents / 100).toFixed(2).replace(".", ",")}
              </dd>
            </div>
            <div>
              <dt className="inline text-amber-800">Status gateway:</dt>{" "}
              <dd className="inline font-medium">
                {lastCharge.gatewayStatus === "awaiting_payment" ? "aguardando pagamento" : "pago"}
              </dd>
            </div>
          </dl>
          {lastCharge.gatewayStatus === "awaiting_payment" ? (
            <button
              type="button"
              onClick={handleSimulateGateway}
              className="mt-4 w-full rounded-full border border-amber-400 bg-white px-4 py-2.5 text-sm font-semibold text-amber-950 hover:bg-amber-100"
            >
              Simular pagamento aprovado (webhook)
            </button>
          ) : (
            <p className="mt-3 text-sm font-medium text-emerald-800">Pagamento registrado. Veja em Minhas consultas.</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
