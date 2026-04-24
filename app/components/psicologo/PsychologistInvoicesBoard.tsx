"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchPsychologistAgenda, type ApiPsychologistAgendaAppointment } from "@/app/lib/psychologist-agenda-api";

function addMinutesToHHMM(hhmm: string, minutesToAdd: number): string {
  const [hs, ms] = hhmm.split(":").map(Number);
  if (!Number.isFinite(hs) || !Number.isFinite(ms)) return hhmm;
  const total = hs * 60 + ms + minutesToAdd;
  const normalized = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function agendaStatusPt(s: ApiPsychologistAgendaAppointment): string {
  if (s.status === "confirmada") return "Confirmada";
  if (s.status === "pendente") return "Pendente confirmação";
  if (s.status === "em_andamento") return "Em andamento";
  if (s.status === "realizada") return "Realizada";
  return "Cancelada";
}

function formatIsoDateLong(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

type ConsultationRow = {
  key: string;
  patientName: string;
  isoDate: string;
  startTime: string;
  endTime: string;
  format: "Online" | "Presencial";
  sessionStatus: string;
  paymentLabel: string;
  priceLabel: string;
};

function buildConsultationRows(agenda: ApiPsychologistAgendaAppointment[]): ConsultationRow[] {
  return agenda
    .map((s) => ({
      key: `agenda-${s.id}`,
      patientName: s.patient_name,
      isoDate: s.iso_date,
      startTime: s.time,
      endTime: addMinutesToHHMM(s.time, s.duration_min ?? 50),
      format: s.format,
      sessionStatus: agendaStatusPt(s),
      priceLabel: (() => {
        const parsed = Number.parseFloat(s.price);
        if (!Number.isFinite(parsed)) return "0,00";
        return parsed.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      })(),
      paymentLabel:
        s.payment_expired
          ? "Pagamento expirado"
          : s.status === "realizada"
          ? "Concluído"
          : s.payment_pending
            ? "Pendente"
            : s.status === "cancelada"
              ? "—"
              : "Pago",
    }))
    .sort((x, y) => {
    const d = y.isoDate.localeCompare(x.isoDate);
    if (d !== 0) return d;
    return y.startTime.localeCompare(x.startTime);
  });
}

export function PsychologistInvoicesBoard() {
  const [agendaSessions, setAgendaSessions] = useState<ApiPsychologistAgendaAppointment[]>([]);
  const [patientFilter, setPatientFilter] = useState("");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const refresh = useCallback(async () => {
    const today = new Date();
    const fromDate = `${today.getFullYear()}-01-01`;
    const result = await fetchPsychologistAgenda(fromDate);
    if (result.ok && "appointments" in result.data) {
      setAgendaSessions(result.data.appointments);
      setLoadError("");
      setLoading(false);
      return;
    }
    setAgendaSessions([]);
    setLoadError("Não foi possível carregar consultas e pagamentos pela API.");
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    function onBilling() {
      void refresh();
    }
    function onAgenda() {
      void refresh();
    }
    window.addEventListener("psychologist-availability-changed", onBilling);
    window.addEventListener("psychologist-agenda-changed", onAgenda);
    return () => {
      window.removeEventListener("psychologist-availability-changed", onBilling);
      window.removeEventListener("psychologist-agenda-changed", onAgenda);
    };
  }, [refresh]);

  const unified = useMemo(() => buildConsultationRows(agendaSessions), [agendaSessions]);

  const patientNames = useMemo(() => {
    const set = new Set<string>();
    unified.forEach((r) => set.add(r.patientName.trim()));
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [unified]);

  const filteredUnified = useMemo(() => {
    const q = patientFilter.trim().toLowerCase();
    return unified.filter((r) => {
      const patientOk = !q || r.patientName.trim().toLowerCase() === q;
      const fromOk = !dateFromFilter || r.isoDate >= dateFromFilter;
      const toOk = !dateToFilter || r.isoDate <= dateToFilter;
      return patientOk && fromOk && toOk;
    });
  }, [unified, patientFilter, dateFromFilter, dateToFilter]);

  const totalPendente = useMemo(() => {
    return filteredUnified
      .filter((r) => r.paymentLabel === "Pendente")
      .length;
  }, [filteredUnified]);

  const totalPago = useMemo(() => {
    return filteredUnified.filter((r) => r.paymentLabel === "Pago" || r.paymentLabel === "Concluído").length;
  }, [filteredUnified]);

  const totalRealizados = useMemo(() => {
    return filteredUnified.filter((r) => r.sessionStatus === "Realizada").length;
  }, [filteredUnified]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-emerald-100 bg-white p-10 text-center text-sm text-slate-500">
        Carregando consultas…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-teal-50/40 p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800">Acompanhamento de consultas</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Consultas e pagamentos</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          Veja suas consultas de forma simples: paciente, dia, horário, situação do atendimento e pagamento.
        </p>
      </section>
      {loadError ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{loadError}</section>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">Pagamentos pendentes</p>
          <p className="mt-1 text-lg font-semibold text-amber-950">{totalPendente}</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900">Pagamentos confirmados</p>
          <p className="mt-1 text-lg font-semibold text-emerald-950">{totalPago}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Atendimentos realizados</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{totalRealizados}</p>
        </div>
      </div>

      {patientNames.length > 0 ? (
        <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
          <p className="block text-sm font-semibold text-slate-900">Filtros</p>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            <label className="block">
              <span className="text-xs text-slate-600">Paciente</span>
              <select
                id="consultas-patient-filter"
                value={patientFilter}
                onChange={(e) => setPatientFilter(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-emerald-500/20 transition focus:border-emerald-500 focus:ring-2"
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
            </label>
            <label className="block">
              <span className="text-xs text-slate-600">De</span>
              <input
                type="date"
                value={dateFromFilter}
                onChange={(e) => setDateFromFilter(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-emerald-500/20 transition focus:border-emerald-500 focus:ring-2"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-600">Até</span>
              <input
                type="date"
                value={dateToFilter}
                onChange={(e) => setDateToFilter(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-emerald-500/20 transition focus:border-emerald-500 focus:ring-2"
              />
            </label>
          </div>
        </div>
      ) : null}

      {unified.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
          Nenhuma consulta encontrada na API.
        </p>
      ) : filteredUnified.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
          Nenhuma consulta para o paciente selecionado. Escolha outro filtro ou &quot;Todos os pacientes&quot;.
        </p>
      ) : (
        <ol className="space-y-6">
          {filteredUnified.map((row) => {
            return (
              <li key={row.key}>
                <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-4 sm:px-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Data</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">{formatIsoDateLong(row.isoDate)}</p>
                        <p className="text-sm text-slate-600">{row.startTime} - {row.endTime}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-6 p-5 sm:p-6">
                    <div className="space-y-5">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Histórico da consulta
                        </p>
                        <p className="mt-2 text-base font-semibold text-slate-900">{row.patientName}</p>
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
                          <span className="text-sm font-semibold text-slate-900">R$ {row.priceLabel}</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          As faturas detalhadas ficam disponíveis no fluxo financeiro da clínica/backend.
                        </p>
                      </div>
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
        <Link href="/psicologo/agenda" className="text-slate-500 underline hover:text-slate-800">
          Ver agenda completa
        </Link>
      </div>
    </div>
  );
}
