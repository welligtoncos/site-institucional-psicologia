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

  const upcoming = useMemo(() => rows.filter(isAppointmentUpcoming), [rows]);
  const upcomingSorted = useMemo(() => {
    return [...upcoming].sort((a, b) => {
      const da = a.isoDate.localeCompare(b.isoDate);
      if (da !== 0) return da;
      return a.time.localeCompare(b.time);
    });
  }, [upcoming]);

  const history = useMemo(() => rows.filter(isAppointmentHistory), [rows]);
  const historyVisible = useMemo(() => {
    return history.filter((a) => {
      if (historyFilter === "todos") return true;
      if (historyFilter === "realizada") return a.status === "realizada";
      if (historyFilter === "cancelada") return a.status === "cancelada";
      return a.status === "nao_compareceu";
    });
  }, [history, historyFilter]);

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

      {mainTab === "proximas" ? (
        <section className="space-y-3">
          {upcomingSorted.length === 0 ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-6 text-center text-sm text-slate-600">
              Nenhuma consulta futura.{" "}
              <Link href="/portal/agendar" className="font-medium text-sky-700 underline">
                Agendar
              </Link>
            </p>
          ) : (
            upcomingSorted.map((a) => <AppointmentRow key={a.id} a={a} />)
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
            <Link
              href={`/portal/consultas/sala?appointmentId=${encodeURIComponent(a.id)}`}
              className="inline-flex text-sm font-medium text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-900"
            >
              Entrar na sala online
            </Link>
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
