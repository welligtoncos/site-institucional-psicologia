"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  formatAppointmentDatePt,
  isAppointmentHistory,
  isAppointmentUpcoming,
  type MockAppointment,
  type MockAppointmentStatus,
} from "@/app/lib/portal-mocks";
import { listPatientAppointments, type ApiPatientAppointmentSummary } from "@/app/lib/portal-appointments-api";

function statusLabel(s: MockAppointmentStatus): string {
  const map: Record<MockAppointmentStatus, string> = {
    agendada: "Agendada",
    confirmada: "Confirmada",
    em_andamento: "Em andamento",
    realizada: "Concluída",
    cancelada: "Cancelada",
    nao_compareceu: "Não compareceu",
  };
  return map[s];
}

function statusStyles(s: MockAppointmentStatus): string {
  if (s === "confirmada" || s === "realizada") return "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80";
  if (s === "em_andamento") return "bg-violet-50 text-violet-800 ring-1 ring-violet-200/80";
  if (s === "agendada") return "bg-sky-50 text-sky-800 ring-1 ring-sky-200/80";
  if (s === "cancelada") return "bg-rose-50 text-rose-800 ring-1 ring-rose-200/80";
  if (s === "nao_compareceu") return "bg-amber-50 text-amber-900 ring-1 ring-amber-200/80";
  return "bg-slate-50 text-slate-700 ring-1 ring-slate-200/80";
}

type MainTab = "proximas" | "historico";

type HistoryFilter = "todos" | "realizada" | "cancelada" | "falta";
type DatePreset = "todos" | "hoje" | "proximos7" | "mes" | "data";

function toLocalDateFromIso(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, 0, 0, 0, 0);
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isWithinNextDays(target: Date, daysAhead: number): boolean {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + daysAhead);
  return target >= start && target <= end;
}

function mapApiAppointment(a: ApiPatientAppointmentSummary): MockAppointment {
  return {
    id: a.id,
    psychId: a.psychologist_id,
    psychologist: a.psychologist_name,
    psychologistCrp: a.psychologist_crp,
    patientName: a.patient_name,
    specialty: a.specialty,
    isoDate: a.iso_date,
    time: a.time,
    format: a.format,
    price: Number(a.price),
    durationMin: a.duration_min,
    payment: a.payment,
    status: a.status,
    videoCallLink: a.video_call_link ?? undefined,
    notes: "",
  };
}

export function AppointmentsBoard() {
  const [rows, setRows] = useState<MockAppointment[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [loadingError, setLoadingError] = useState("");
  const [mainTab, setMainTab] = useState<MainTab>("proximas");
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("todos");
  const [dateFilter, setDateFilter] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("todos");

  const loadAppointments = useCallback(async () => {
    const out = await listPatientAppointments("2000-01-01");
    if (!out.ok) {
      setRows([]);
      setLoadingError(out.detail);
      setHydrated(true);
      return;
    }
    setRows(out.data.appointments.map(mapApiAppointment));
    setLoadingError("");
    setHydrated(true);
  }, []);

  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);

  useEffect(() => {
    const reload = () => {
      void loadAppointments();
    };
    window.addEventListener("portal-billing-changed", reload);
    window.addEventListener("storage", reload);
    window.addEventListener("focus", reload);
    return () => {
      window.removeEventListener("portal-billing-changed", reload);
      window.removeEventListener("storage", reload);
      window.removeEventListener("focus", reload);
    };
  }, [loadAppointments]);

  const matchesDateFilter = useCallback(
    (isoDate: string) => {
      const target = toLocalDateFromIso(isoDate);
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
      if (datePreset === "todos") return true;
      if (datePreset === "data") return dateFilter ? isoDate === dateFilter : true;
      if (datePreset === "hoje") return isSameDay(target, todayStart);
      if (datePreset === "proximos7") return isWithinNextDays(target, 7);
      return target.getFullYear() === todayStart.getFullYear() && target.getMonth() === todayStart.getMonth();
    },
    [dateFilter, datePreset],
  );

  const upcoming = useMemo(() => rows.filter(isAppointmentUpcoming), [rows]);
  const upcomingSorted = useMemo(() => {
    return [...upcoming].sort((a, b) => {
      const da = a.isoDate.localeCompare(b.isoDate);
      if (da !== 0) return da;
      return a.time.localeCompare(b.time);
    });
  }, [upcoming]);
  const upcomingVisible = useMemo(() => {
    return upcomingSorted.filter((a) => matchesDateFilter(a.isoDate));
  }, [upcomingSorted, matchesDateFilter]);

  const history = useMemo(() => rows.filter(isAppointmentHistory), [rows]);
  const historyVisible = useMemo(() => {
    const statusFiltered = history.filter((a) => {
      if (historyFilter === "todos") return true;
      if (historyFilter === "realizada") return a.status === "realizada";
      if (historyFilter === "cancelada") return a.status === "cancelada";
      return a.status === "nao_compareceu";
    });
    return statusFiltered.filter((a) => matchesDateFilter(a.isoDate));
  }, [history, historyFilter, matchesDateFilter]);

  const nextSlot = useMemo(() => upcomingSorted[0] ?? null, [upcomingSorted]);

  if (!hydrated) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
        Carregando…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-900">Minhas consultas</h1>
        <p className="text-sm text-slate-500">Suas sessões na clínica.</p>
      </header>

      {loadingError ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">{loadingError}</p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/portal/agendar"
          className="text-sm font-medium text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-900"
        >
          Agendar consulta
        </Link>
        {nextSlot ? (
          <p className="text-xs text-slate-500">
            Próxima:{" "}
            <span className="font-medium text-slate-700">
              {formatAppointmentDatePt(nextSlot.isoDate)} {nextSlot.time}
            </span>
          </p>
        ) : null}
      </div>

      {mainTab === "proximas" && upcomingVisible.some((appointment) => appointment.format === "Online") ? (
        <section className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
          <p className="text-sm font-semibold text-sky-900">Atendimento ao vivo</p>
          <p className="mt-1 text-sm text-sky-800">
            Para iniciar sua consulta online, clique em <span className="font-semibold">Entrar na sala online</span> no horário da
            sessão.
          </p>
        </section>
      ) : null}

      <div className="flex gap-1 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setMainTab("proximas")}
          className={`border-b-2 px-3 py-2 text-sm font-medium transition ${
            mainTab === "proximas"
              ? "-mb-px border-sky-600 text-sky-900"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Próximas{upcoming.length ? ` (${upcoming.length})` : ""}
        </button>
        <button
          type="button"
          onClick={() => setMainTab("historico")}
          className={`border-b-2 px-3 py-2 text-sm font-medium transition ${
            mainTab === "historico"
              ? "-mb-px border-sky-600 text-sky-900"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Histórico{history.length ? ` (${history.length})` : ""}
        </button>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white px-4 py-3">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["todos", "Todas as datas"],
                ["hoje", "Hoje"],
                ["proximos7", "Próximos 7 dias"],
                ["mes", "Este mês"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setDatePreset(id);
                  setDateFilter("");
                }}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                  datePreset === id ? "bg-sky-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
            <label htmlFor="appointments-date-filter" className="text-xs font-medium uppercase tracking-wide text-slate-600">
              Filtrar por data
            </label>
            <input
              id="appointments-date-filter"
              type="date"
              value={dateFilter}
              onChange={(e) => {
                const value = e.target.value;
                setDateFilter(value);
                setDatePreset(value ? "data" : "todos");
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200 sm:w-auto"
            />
            </div>
            {datePreset !== "todos" || dateFilter ? (
              <button
                type="button"
                onClick={() => {
                  setDateFilter("");
                  setDatePreset("todos");
                }}
                className="self-start rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 sm:self-auto"
              >
                Limpar filtro
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {mainTab === "proximas" ? (
        <section className="space-y-3">
          {upcomingVisible.length === 0 ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-6 text-center text-sm text-slate-600">
              Nenhuma consulta futura.{" "}
              <Link href="/portal/agendar" className="font-medium text-sky-700 underline">
                Agendar
              </Link>
            </p>
          ) : (
            upcomingVisible.map((a) => <AppointmentRow key={a.id} a={a} />)
          )}
        </section>
      ) : (
        <section className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["todos", "Todas"],
                ["realizada", "Concluídas"],
                ["cancelada", "Canceladas"],
                ["falta", "Faltas"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setHistoryFilter(id)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                  historyFilter === id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {historyVisible.length === 0 ? (
            <p className="rounded-lg border border-slate-200 px-4 py-6 text-center text-sm text-slate-500">Nada aqui.</p>
          ) : (
            historyVisible.map((a) => <AppointmentRow key={a.id} a={a} />)
          )}
        </section>
      )}
    </div>
  );
}

function AppointmentRow({ a }: { a: MockAppointment }) {
  const upcoming = isAppointmentUpcoming(a);
  const canOpenRoomFlow =
    a.format === "Online" && upcoming && a.payment === "Pago" && (a.status === "confirmada" || a.status === "em_andamento");

  return (
    <article className="rounded-lg border border-slate-200/90 bg-white px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-slate-900">{a.psychologist}</p>
          <p className="text-xs text-slate-500">
            {a.specialty}
            {a.psychologistCrp ? ` · CRP ${a.psychologistCrp}` : ""}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            {formatAppointmentDatePt(a.isoDate)} · {a.time} · {a.format}
            <span className="text-slate-400"> · </span>
            R$ {a.price.toFixed(2).replace(".", ",")}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Pagamento:{" "}
            <span className={a.payment === "Pago" ? "font-medium text-emerald-700" : "font-medium text-amber-700"}>
              {a.payment}
            </span>
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles(a.status)}`}>
          {statusLabel(a.status)}
        </span>
      </div>

      {a.format === "Online" && upcoming ? (
        <div className="mt-3 border-t border-slate-100 pt-3">
          {canOpenRoomFlow ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-700">Seu atendimento ao vivo começa ao entrar na sala.</p>
              <Link
                href={`/portal/consultas/sala?appointmentId=${encodeURIComponent(a.id)}`}
                prefetch={false}
                className="inline-flex items-center rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                Entrar na sala online
              </Link>
            </div>
          ) : a.payment === "Pendente" ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs text-amber-700">Pagamento pendente. Conclua para liberar o link da sessão.</p>
              <Link
                href={`/portal/agendar?psych=${encodeURIComponent(a.psychId)}`}
                className="inline-flex rounded-full bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
              >
                Pagar agora
              </Link>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Link da sessão aparece após confirmação do pagamento.</p>
          )}
        </div>
      ) : null}

    </article>
  );
}
