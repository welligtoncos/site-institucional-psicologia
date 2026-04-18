"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  MOCK_PSYCHOLOGIST,
  formatAppointmentDatePt,
  type MockAppointment,
} from "@/app/lib/portal-mocks";
import {
  getAllPaymentCharges,
  getPatientAppointments,
  type MockPaymentCharge,
} from "@/app/lib/portal-payment-mock";
import {
  PSYCHOLOGIST_PATIENTS_SEED,
  formatIsoDateLong,
  loadAgendaAppointments,
  type PsychologistAgendaAppointment,
  type PsychologistPatient,
} from "@/app/lib/psicologo-mocks";

function formatMoneyBrl(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function formatMoneyReais(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

function chargeStatusLabel(c: MockPaymentCharge): string {
  if (c.gatewayStatus === "succeeded") return "Pago";
  if (c.gatewayStatus === "failed") return "Falhou";
  return "Pendente";
}

function formatDateTimePt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatDateShort(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function portalStatusPt(a: MockAppointment): string {
  const map: Record<string, string> = {
    agendada: "Agendada",
    confirmada: "Confirmada",
    em_andamento: "Em andamento",
    realizada: "Realizada",
    cancelada: "Cancelada",
    nao_compareceu: "Não compareceu",
  };
  return map[a.status] ?? a.status;
}

function agendaStatusPt(s: PsychologistAgendaAppointment): string {
  if (s.status === "confirmada") return "Confirmada";
  if (s.status === "pendente") return "Pendente confirmação";
  if (s.status === "realizada") return "Realizada";
  return "Cancelada";
}

function findPatientProfile(name: string): PsychologistPatient | undefined {
  const n = name.trim().toLowerCase();
  return PSYCHOLOGIST_PATIENTS_SEED.find((p) => p.name.trim().toLowerCase() === n);
}

type UnifiedConsultation = {
  key: string;
  source: "portal" | "agenda";
  patientName: string;
  isoDate: string;
  time: string;
  format: "Online" | "Presencial";
  sessionStatus: string;
  paymentLabel: string;
  priceReais: number;
  charge?: MockPaymentCharge;
};

function buildUnifiedRows(
  portal: MockAppointment[],
  agenda: PsychologistAgendaAppointment[],
  charges: MockPaymentCharge[],
): UnifiedConsultation[] {
  const chargeByApptId = new Map<string, MockPaymentCharge>();
  for (const c of charges) {
    chargeByApptId.set(c.appointmentId, c);
  }

  const rows: UnifiedConsultation[] = [];

  for (const a of portal) {
    const ch =
      (a.id && chargeByApptId.get(a.id)) ||
      (a.chargeId ? charges.find((c) => c.id === a.chargeId) : undefined);
    rows.push({
      key: `portal-${a.id}`,
      source: "portal",
      patientName: a.patientName?.trim() || "Paciente",
      isoDate: a.isoDate,
      time: a.time,
      format: a.format,
      sessionStatus: portalStatusPt(a),
      paymentLabel: a.payment,
      priceReais: a.price,
      charge: ch,
    });
  }

  for (const s of agenda) {
    rows.push({
      key: `agenda-${s.id}`,
      source: "agenda",
      patientName: s.patientName,
      isoDate: s.isoDate,
      time: s.time,
      format: s.format,
      sessionStatus: agendaStatusPt(s),
      paymentLabel:
        s.status === "realizada"
          ? "Concluída"
          : s.pagamentoPendente
            ? "Pendente"
            : s.status === "cancelada"
              ? "—"
              : "A combinar",
      priceReais: MOCK_PSYCHOLOGIST.price,
    });
  }

  return rows.sort((x, y) => {
    const d = y.isoDate.localeCompare(x.isoDate);
    if (d !== 0) return d;
    return y.time.localeCompare(x.time);
  });
}

function dueDateFromCharge(createdAt: string): string {
  try {
    const d = new Date(createdAt);
    d.setDate(d.getDate() + 7);
    return d.toISOString();
  } catch {
    return createdAt;
  }
}

function mockNfeNumber(chargeId: string): string {
  const tail = chargeId.replace(/\W/g, "").slice(-5).padStart(5, "0");
  return `000.312.${tail.slice(0, 3)}-${tail.slice(-1)}`;
}

export function PsychologistInvoicesBoard() {
  const [charges, setCharges] = useState<MockPaymentCharge[]>([]);
  const [appointments, setAppointments] = useState<MockAppointment[]>([]);
  const [agendaSessions, setAgendaSessions] = useState<PsychologistAgendaAppointment[]>([]);
  const [patientFilter, setPatientFilter] = useState("");
  const [ready, setReady] = useState(false);

  const refresh = useCallback(() => {
    setCharges(getAllPaymentCharges());
    setAppointments(getPatientAppointments());
    setAgendaSessions(loadAgendaAppointments());
  }, []);

  useEffect(() => {
    refresh();
    setReady(true);
    function onBilling() {
      refresh();
    }
    function onAgenda() {
      refresh();
    }
    window.addEventListener("storage", onBilling);
    window.addEventListener("portal-billing-changed", onBilling);
    window.addEventListener("psychologist-agenda-changed", onAgenda);
    return () => {
      window.removeEventListener("storage", onBilling);
      window.removeEventListener("portal-billing-changed", onBilling);
      window.removeEventListener("psychologist-agenda-changed", onAgenda);
    };
  }, [refresh]);

  const myPsychId = MOCK_PSYCHOLOGIST.id;

  const myPortalAppointments = useMemo(
    () => appointments.filter((a) => a.psychId === myPsychId),
    [appointments, myPsychId],
  );

  const unified = useMemo(
    () => buildUnifiedRows(myPortalAppointments, agendaSessions, charges),
    [myPortalAppointments, agendaSessions, charges],
  );

  const patientNames = useMemo(() => {
    const set = new Set<string>();
    unified.forEach((r) => set.add(r.patientName.trim()));
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [unified]);

  const filteredUnified = useMemo(() => {
    const q = patientFilter.trim().toLowerCase();
    if (!q) return unified;
    return unified.filter((r) => r.patientName.trim().toLowerCase() === q);
  }, [unified, patientFilter]);

  const totalPendente = useMemo(() => {
    return filteredUnified
      .filter((r) => r.charge?.gatewayStatus === "awaiting_payment")
      .reduce((s, r) => s + (r.charge?.amountCents ?? 0), 0);
  }, [filteredUnified]);

  const totalPago = useMemo(() => {
    return filteredUnified
      .filter((r) => r.charge?.gatewayStatus === "succeeded")
      .reduce((s, r) => s + (r.charge?.amountCents ?? 0), 0);
  }, [filteredUnified]);

  function demoOpenInvoice(ref: string) {
    toast.message(`Demonstração: abrir documento ${ref} (PDF ou gateway).`);
  }

  if (!ready) {
    return (
      <div className="rounded-2xl border border-emerald-100 bg-white p-10 text-center text-sm text-slate-500">
        Carregando consultas…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-teal-50/40 p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800">Histórico clínico · pagamentos</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Minhas consultas</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          Cada item mostra a <strong className="font-semibold text-slate-800">data</strong>, o{" "}
          <strong className="font-semibold text-slate-800">histórico</strong> da sessão (paciente e situação), o{" "}
          <strong className="font-semibold text-slate-800">pagamento</strong> e a{" "}
          <strong className="font-semibold text-slate-800">fatura</strong> quando existir cobrança no portal (mock).
        </p>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">Pagamentos pendentes</p>
          <p className="mt-1 text-lg font-semibold text-amber-950">R$ {formatMoneyBrl(totalPendente)}</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900">Pagamentos confirmados</p>
          <p className="mt-1 text-lg font-semibold text-emerald-950">R$ {formatMoneyBrl(totalPago)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Consultas (filtro atual)</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{filteredUnified.length}</p>
        </div>
      </div>

      {patientNames.length > 0 ? (
        <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
          <label htmlFor="consultas-patient-filter" className="block text-sm font-semibold text-slate-900">
            Filtrar por paciente
          </label>
          <select
            id="consultas-patient-filter"
            value={patientFilter}
            onChange={(e) => setPatientFilter(e.target.value)}
            className="mt-2 w-full max-w-md rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-emerald-500/20 transition focus:border-emerald-500 focus:ring-2 sm:mt-0"
          >
            <option value="">Todos os pacientes ({unified.length})</option>
            {patientNames.map((name) => {
              const count = unified.filter((r) => r.patientName.trim() === name).length;
              return (
                <option key={name} value={name}>
                  {name} ({count})
                </option>
              );
            })}
          </select>
        </div>
      ) : null}

      {unified.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
          Nenhuma consulta nos dados de demonstração.
        </p>
      ) : filteredUnified.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
          Nenhuma consulta para o paciente selecionado. Escolha outro filtro ou &quot;Todos os pacientes&quot;.
        </p>
      ) : (
        <ol className="space-y-6">
          {filteredUnified.map((row) => {
            const profile = findPatientProfile(row.patientName);
            return (
              <li key={row.key}>
                <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-4 sm:px-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Data</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">{formatIsoDateLong(row.isoDate)}</p>
                        <p className="text-sm text-slate-600">{row.time}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatAppointmentDatePt(row.isoDate)} · {MOCK_PSYCHOLOGIST.name}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                          row.source === "portal"
                            ? "bg-sky-100 text-sky-900"
                            : "bg-violet-100 text-violet-900"
                        }`}
                      >
                        {row.source === "portal" ? "Portal do paciente" : "Agenda"}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_minmax(0,340px)]">
                    <div className="space-y-5">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Histórico da consulta
                        </p>
                        <p className="mt-2 text-base font-semibold text-slate-900">{row.patientName}</p>
                        {profile ? (
                          <p className="mt-1 text-xs text-slate-600">
                            {profile.email} · {profile.phone}
                          </p>
                        ) : null}
                        <ul className="mt-3 space-y-1 text-sm text-slate-700">
                          <li>
                            <span className="text-slate-500">Situação: </span>
                            {row.sessionStatus}
                          </li>
                          <li>
                            <span className="text-slate-500">Formato: </span>
                            {row.format}
                          </li>
                        </ul>
                      </div>

                      <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Pagamento</p>
                        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
                          <span
                            className={`text-sm font-semibold ${
                              row.paymentLabel === "Pago"
                                ? "text-emerald-800"
                                : row.paymentLabel === "Pendente"
                                  ? "text-amber-800"
                                  : "text-slate-700"
                            }`}
                          >
                            {row.paymentLabel}
                          </span>
                          <span className="text-base font-bold text-slate-900">
                            R$ {formatMoneyReais(row.priceReais)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">Valor de referência da sessão neste registro.</p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-emerald-100/90 bg-emerald-50/30 p-4 lg:border-l lg:border-t-0 lg:border-slate-100 lg:bg-white lg:p-0 lg:pl-6">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-900">Fatura</p>
                      {row.charge ? (
                        <div className="mt-3 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-mono text-xs text-slate-700">NF-e {mockNfeNumber(row.charge.id)}</span>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                                row.charge.gatewayStatus === "succeeded"
                                  ? "bg-emerald-100 text-emerald-900"
                                  : row.charge.gatewayStatus === "failed"
                                    ? "bg-rose-100 text-rose-800"
                                    : "bg-amber-100 text-amber-900"
                              }`}
                            >
                              {chargeStatusLabel(row.charge)}
                            </span>
                          </div>
                          <dl className="grid gap-2 text-xs text-slate-700">
                            <div className="flex justify-between gap-2 border-b border-slate-100 pb-2">
                              <dt className="text-slate-500">Valor cobrança</dt>
                              <dd className="font-semibold">R$ {formatMoneyBrl(row.charge.amountCents)}</dd>
                            </div>
                            <div className="flex justify-between gap-2">
                              <dt className="text-slate-500">Emitida</dt>
                              <dd>{formatDateTimePt(row.charge.createdAt)}</dd>
                            </div>
                            <div className="flex justify-between gap-2">
                              <dt className="text-slate-500">Vencimento (demo)</dt>
                              <dd>{formatDateShort(dueDateFromCharge(row.charge.createdAt))}</dd>
                            </div>
                            {row.charge.paidAt ? (
                              <div className="flex justify-between gap-2 text-emerald-800">
                                <dt>Pago em</dt>
                                <dd>{formatDateTimePt(row.charge.paidAt)}</dd>
                              </div>
                            ) : null}
                            <div className="flex justify-between gap-2 font-mono text-[11px] text-slate-600">
                              <dt className="font-sans text-slate-500">Ref. gateway</dt>
                              <dd className="truncate">{row.charge.gatewayIntentId}</dd>
                            </div>
                          </dl>
                          <div className="flex flex-wrap gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => demoOpenInvoice(mockNfeNumber(row.charge!.id))}
                              className="rounded-full bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                            >
                              Ver fatura
                            </button>
                            <button
                              type="button"
                              onClick={() => demoOpenInvoice("comprovante")}
                              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                            >
                              Comprovante
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-3 text-sm leading-relaxed text-slate-600">
                          {row.source === "portal"
                            ? "Sem fatura eletrônica no gateway para esta consulta (demonstração)."
                            : "Consulta só na agenda interna — fatura quando houver agendamento pelo portal ou lançamento manual."}
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ol>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-5 py-4 text-xs text-slate-600">
        <Link href="/psicologo/pacientes" className="font-semibold text-emerald-800 underline hover:text-emerald-950">
          Ver cadastro dos pacientes
        </Link>
        <Link href="/portal/faturamento" className="text-slate-500 underline hover:text-slate-800">
          Visão do paciente (faturamento)
        </Link>
      </div>
    </div>
  );
}
