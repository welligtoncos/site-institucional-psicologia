"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  formatAppointmentDatePt,
  isAppointmentHistory,
  isAppointmentUpcoming,
  type MockAppointment,
  type MockAppointmentStatus,
} from "@/app/lib/portal-mocks";
import { listPatientAppointments, simulatePatientAppointmentPayment, type ApiPatientAppointmentSummary } from "@/app/lib/portal-appointments-api";

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
  if (s === "confirmada" || s === "realizada") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (s === "em_andamento") return "border-violet-200 bg-violet-50 text-violet-800";
  if (s === "agendada") return "border-sky-200 bg-sky-50 text-sky-800";
  if (s === "cancelada") return "border-rose-200 bg-rose-50 text-rose-800";
  if (s === "nao_compareceu") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-slate-200 bg-slate-100 text-slate-700";
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
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadAppointments = useCallback(async () => {
    // Busca amplo para incluir próximas + histórico.
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

  const handleSimulateGatewayPayment = useCallback(async (appointmentId: string) => {
    const out = await simulatePatientAppointmentPayment(appointmentId);
    if (!out.ok) {
      toast.error(out.detail);
      return;
    }
    toast.success("Pagamento registrado. Consulta atualizada.");
    await loadAppointments();
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
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
        Carregando suas consultas…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-sky-100 bg-gradient-to-r from-sky-50 to-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Minhas consultas</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Próximas sessões e histórico</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Na aba <strong className="font-semibold text-slate-800">Próximas e em andamento</strong> você vê cada consulta
          com <strong className="font-semibold text-slate-800">profissional</strong>,{" "}
          <strong className="font-semibold text-slate-800">data e horário</strong>,{" "}
          <strong className="font-semibold text-slate-800">status</strong> e, em atendimentos online, o{" "}
          <strong className="font-semibold text-slate-800">link da sessão</strong> quando estiver disponível. No
          histórico ficam sessões concluídas, canceladas ou falta. Esta tela usa as consultas registradas na API.
        </p>
      </section>

      {loadingError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {loadingError}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/portal/agendar"
          className="inline-flex rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
        >
          Nova consulta
        </Link>
        {nextSlot ? (
          <p className="text-sm text-slate-600">
            Próxima:{" "}
            <span className="font-medium text-slate-900">
              {formatAppointmentDatePt(nextSlot.isoDate)} às {nextSlot.time}
            </span>{" "}
            · {nextSlot.psychologist}
          </p>
        ) : (
          <p className="text-sm text-slate-500">Nenhuma consulta futura na lista.</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-1">
        <button
          type="button"
          onClick={() => setMainTab("proximas")}
          className={`rounded-t-lg px-4 py-2 text-sm font-semibold transition ${
            mainTab === "proximas"
              ? "border border-b-0 border-slate-200 bg-white text-sky-900"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Próximas e em andamento
          {upcoming.length > 0 ? (
            <span className="ml-1.5 rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-800">{upcoming.length}</span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={() => setMainTab("historico")}
          className={`rounded-t-lg px-4 py-2 text-sm font-semibold transition ${
            mainTab === "historico"
              ? "border border-b-0 border-slate-200 bg-white text-sky-900"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Histórico
          {history.length > 0 ? (
            <span className="ml-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{history.length}</span>
          ) : null}
        </button>
      </div>

      {mainTab === "proximas" ? (
        <section className="space-y-4">
          <p className="text-xs leading-relaxed text-slate-500">
            Inclui consultas <strong className="font-medium text-slate-700">futuras</strong> (agendada ou confirmada) e
            sessões já marcadas como <strong className="font-medium text-slate-700">em andamento</strong>. Detalhes
            extras ficam em &quot;Detalhes&quot;.
          </p>
          {upcomingSorted.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
              Você não tem consultas futuras aqui.{" "}
              <Link href="/portal/agendar" className="font-semibold text-sky-700 underline">
                Agendar uma sessão
              </Link>
              .
            </p>
          ) : (
            upcomingSorted.map((a) => (
              <AppointmentCard
                key={a.id}
                a={a}
                expanded={expandedId === a.id}
                onToggleDetails={() => setExpandedId((id) => (id === a.id ? null : a.id))}
                onSimulateGatewayPayment={handleSimulateGatewayPayment}
                readOnly
              />
            ))
          )}
        </section>
      ) : (
        <section className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["todos", "Todos"],
                ["realizada", "Concluídas"],
                ["cancelada", "Canceladas"],
                ["falta", "Faltas"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setHistoryFilter(id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  historyFilter === id
                    ? "border-sky-400 bg-sky-50 text-sky-900"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {historyVisible.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
              Nenhum registro neste filtro.
            </p>
          ) : (
            historyVisible.map((a) => (
              <AppointmentCard
                key={a.id}
                a={a}
                expanded={expandedId === a.id}
                onToggleDetails={() => setExpandedId((id) => (id === a.id ? null : a.id))}
                readOnly
              />
            ))
          )}
        </section>
      )}
    </div>
  );
}

function AppointmentCard({
  a,
  expanded,
  onToggleDetails,
  onCancel,
  onReschedule,
  onSimulateGatewayPayment,
  readOnly,
}: {
  a: MockAppointment;
  expanded: boolean;
  onToggleDetails: () => void;
  onCancel?: () => void;
  onReschedule?: () => void;
  onSimulateGatewayPayment?: (chargeId: string) => void;
  readOnly?: boolean;
}) {
  const canAct = !readOnly && isAppointmentUpcoming(a) && Boolean(onCancel && onReschedule);
  const canSimulatePay =
    !readOnly &&
    a.payment === "Pendente" &&
    onSimulateGatewayPayment;

  const consultaTipo = a.format === "Online" ? "Consulta online" : "Consulta presencial";

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Consulta</p>
          <h2 className="mt-0.5 text-lg font-semibold text-slate-900">{consultaTipo}</h2>
          <p className="mt-1 text-sm font-medium text-slate-800">{a.psychologist}</p>
          <p className="text-sm text-slate-600">
            {a.specialty}
            {a.psychologistCrp ? (
              <>
                <span className="text-slate-400"> · </span>
                CRP {a.psychologistCrp}
              </>
            ) : null}
          </p>
          {a.patientName ? (
            <p className="mt-1 text-xs text-slate-500">
              Paciente: <span className="font-medium text-slate-700">{a.patientName}</span>
            </p>
          ) : null}
        </div>
        <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles(a.status)}`}>
          {statusLabel(a.status)}
        </span>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <div>
          <dt className="text-xs text-slate-500">Data</dt>
          <dd className="font-medium text-slate-900">{formatAppointmentDatePt(a.isoDate)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Horário</dt>
          <dd className="font-medium text-slate-900">{a.time}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Status</dt>
          <dd className="font-medium text-slate-900">{statusLabel(a.status)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Modalidade</dt>
          <dd className="font-medium text-slate-900">{a.format}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Valor</dt>
          <dd className="font-medium text-slate-900">R$ {a.price.toFixed(2).replace(".", ",")}</dd>
        </div>
      </dl>

      {a.format === "Online" && isAppointmentUpcoming(a) ? (
        <div className="mt-4 rounded-xl border border-sky-100 bg-sky-50/50 px-3 py-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">Link da sessão (online)</p>
          {a.videoCallLink ? (
            <a
              href={a.videoCallLink}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Abrir sessão online com ${a.psychologist} em ${formatAppointmentDatePt(a.isoDate)} às ${a.time}`}
              className="mt-2 inline-flex rounded-full border border-sky-300 bg-white px-4 py-2 text-xs font-semibold text-sky-900 shadow-sm hover:bg-sky-50"
            >
              Abrir link da sessão
            </a>
          ) : (
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              O link da videochamada aparece aqui quando o pagamento for confirmado ou quando o profissional
              disponibilizar (demonstração).
            </p>
          )}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onToggleDetails}
          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          {expanded ? "Ocultar detalhes" : "Detalhes"}
        </button>
        {canSimulatePay ? (
          <button
            type="button"
            onClick={() => onSimulateGatewayPayment!(a.id)}
            className="rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
          >
            Registrar pagamento (simular gateway)
          </button>
        ) : null}
        {canAct ? (
          <>
            <button
              type="button"
              onClick={onReschedule}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              Remarcar
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-100"
            >
              Cancelar
            </button>
          </>
        ) : null}
      </div>

      {expanded ? (
        <div className="mt-4 border-t border-slate-100 pt-4 text-sm text-slate-700">
          <p>
            <span className="text-slate-500">Pagamento:</span>{" "}
            <span className={a.payment === "Pago" ? "font-medium text-emerald-700" : "font-medium text-amber-700"}>
              {a.payment}
            </span>
            {" · "}
            <span className="text-slate-500">Duração:</span> {a.durationMin} min
          </p>
          {a.notes ? (
            <p className="mt-2 text-slate-600">
              <span className="font-medium text-slate-800">Observações:</span> {a.notes}
            </p>
          ) : null}
          {a.videoCallLink && a.format === "Online" ? (
            <p className="mt-2 break-all text-xs text-sky-700">{a.videoCallLink}</p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
