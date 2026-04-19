"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  MOCK_APPOINTMENTS_SEED,
  PORTAL_APPOINTMENTS_STORAGE_KEY,
  PORTAL_CANCEL_MIN_HOURS,
  canModifyAppointment,
  formatAppointmentDatePt,
  isAppointmentHistory,
  isAppointmentUpcoming,
  mockSlotsForDate,
  nextDates,
  type MockAppointment,
  type MockAppointmentStatus,
} from "@/app/lib/portal-mocks";
import { getChargeById, registerGatewayPaymentSuccess } from "@/app/lib/portal-payment-mock";

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

function loadStored(): MockAppointment[] {
  if (typeof window === "undefined") return MOCK_APPOINTMENTS_SEED;
  try {
    const raw = localStorage.getItem(PORTAL_APPOINTMENTS_STORAGE_KEY);
    if (!raw) return MOCK_APPOINTMENTS_SEED;
    const parsed = JSON.parse(raw) as MockAppointment[];
    if (!Array.isArray(parsed) || parsed.length === 0) return MOCK_APPOINTMENTS_SEED;
    return parsed;
  } catch {
    return MOCK_APPOINTMENTS_SEED;
  }
}

export function AppointmentsBoard() {
  const [rows, setRows] = useState<MockAppointment[]>(MOCK_APPOINTMENTS_SEED);
  const [hydrated, setHydrated] = useState(false);
  const [mainTab, setMainTab] = useState<MainTab>("proximas");
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("todos");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [cancelId, setCancelId] = useState<string | null>(null);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");

  useEffect(() => {
    setRows(loadStored());
    setHydrated(true);
  }, []);

  useEffect(() => {
    function reload() {
      setRows(loadStored());
    }
    window.addEventListener("portal-billing-changed", reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener("portal-billing-changed", reload);
      window.removeEventListener("storage", reload);
    };
  }, []);

  const persist = useCallback((next: MockAppointment[]) => {
    setRows(next);
    if (typeof window !== "undefined") {
      localStorage.setItem(PORTAL_APPOINTMENTS_STORAGE_KEY, JSON.stringify(next));
    }
  }, []);

  const handleSimulateGatewayPayment = useCallback(
    (chargeId: string) => {
      const result = registerGatewayPaymentSuccess(chargeId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Pagamento registrado. Consulta atualizada.");
      setRows(loadStored());
    },
    [],
  );

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

  const cancelTarget = cancelId ? rows.find((r) => r.id === cancelId) : null;
  const rescheduleTarget = rescheduleId ? rows.find((r) => r.id === rescheduleId) : null;

  const rescheduleDates = useMemo(() => nextDates(new Date(), 14), []);
  useEffect(() => {
    if (rescheduleTarget && !rescheduleDate && rescheduleDates.length > 0) {
      setRescheduleDate(rescheduleDates[0]!);
    }
  }, [rescheduleTarget, rescheduleDate, rescheduleDates]);

  const rescheduleSlots = useMemo(() => {
    if (!rescheduleTarget || !rescheduleDate) return [];
    return mockSlotsForDate(rescheduleTarget.psychId, rescheduleDate);
  }, [rescheduleTarget, rescheduleDate]);

  function handleCancelConfirm() {
    if (!cancelTarget) return;
    const check = canModifyAppointment(cancelTarget.isoDate, cancelTarget.time);
    if (!check.ok) {
      toast.error(check.message);
      setCancelId(null);
      return;
    }
    persist(
      rows.map((r) =>
        r.id === cancelTarget.id
          ? { ...r, status: "cancelada" as const, reminder: undefined, videoCallLink: undefined, notes: r.notes ?? "Cancelada pelo paciente no portal (mock)." }
          : r,
      ),
    );
    setCancelId(null);
    setMainTab("historico");
    setHistoryFilter("cancelada");
    toast.success("Consulta cancelada.");
  }

  function handleRescheduleConfirm() {
    if (!rescheduleTarget || !rescheduleDate || !rescheduleTime) return;
    const check = canModifyAppointment(rescheduleTarget.isoDate, rescheduleTarget.time);
    if (!check.ok) {
      toast.error(check.message);
      setRescheduleId(null);
      return;
    }
    persist(
      rows.map((r) =>
        r.id === rescheduleTarget.id
          ? {
              ...r,
              isoDate: rescheduleDate,
              time: rescheduleTime,
              status: "confirmada" as const,
              reminder: "Horário atualizado. Novo lembrete será enviado (mock).",
            }
          : r,
      ),
    );
    setRescheduleId(null);
    setRescheduleTime("");
    toast.success("Consulta remarcada.");
  }

  function openReschedule(a: MockAppointment) {
    const check = canModifyAppointment(a.isoDate, a.time);
    if (!check.ok) {
      toast.error(check.message);
      return;
    }
    setRescheduleDate(a.isoDate);
    setRescheduleTime(a.time);
    setRescheduleId(a.id);
  }

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
          Veja datas, valores e status. Você pode <strong className="font-semibold text-slate-800">cancelar</strong> ou{" "}
          <strong className="font-semibold text-slate-800">remarcar</strong> respeitando pelo menos{" "}
          {PORTAL_CANCEL_MIN_HOURS} horas de antecedência (demonstração no navegador).
        </p>
      </section>

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
                onCancel={() => setCancelId(a.id)}
                onReschedule={() => openReschedule(a)}
                onSimulateGatewayPayment={handleSimulateGatewayPayment}
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

      {cancelTarget ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Cancelar consulta?</h2>
            <p className="mt-2 text-sm text-slate-600">
              {cancelTarget.psychologist} — {formatAppointmentDatePt(cancelTarget.isoDate)} às {cancelTarget.time}.
            </p>
            <p className="mt-3 text-xs text-slate-500">
              Cancelamentos com pelo menos {PORTAL_CANCEL_MIN_HOURS}h de antecedência seguem a política de reembolso
              vigente (texto ilustrativo nesta demonstração).
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelId(null)}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleCancelConfirm}
                className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
              >
                Confirmar cancelamento
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {rescheduleTarget ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Remarcar consulta</h2>
            <p className="mt-1 text-sm text-slate-600">
              {rescheduleTarget.psychologist} — disponibilidade fictícia para demonstração.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              A mesma regra de {PORTAL_CANCEL_MIN_HOURS}h se aplica à remarcação em relação ao horário atualmente
              agendado.
            </p>
            <div className="mt-4">
              <p className="text-xs font-medium uppercase text-slate-500">Nova data</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {rescheduleDates.map((iso) => (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => {
                      setRescheduleDate(iso);
                      setRescheduleTime("");
                    }}
                    className={`rounded-lg border px-3 py-2 text-left text-xs ${
                      rescheduleDate === iso ? "border-sky-400 bg-sky-50 font-semibold text-sky-900" : "border-slate-200"
                    }`}
                  >
                    {formatAppointmentDatePt(iso)}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4">
              <p className="text-xs font-medium uppercase text-slate-500">Horário</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {rescheduleSlots.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setRescheduleTime(t)}
                    className={`rounded-full border px-3 py-1.5 text-sm ${
                      rescheduleTime === t ? "border-sky-400 bg-sky-50 font-semibold text-sky-900" : "border-slate-200"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setRescheduleId(null)}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!rescheduleDate || !rescheduleTime}
                onClick={handleRescheduleConfirm}
                className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
              >
                Salvar novo horário
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
  const modCheck = canModifyAppointment(a.isoDate, a.time);
  const canAct = !readOnly && isAppointmentUpcoming(a) && modCheck.ok;
  const charge = a.chargeId ? getChargeById(a.chargeId) : undefined;
  const canSimulatePay =
    !readOnly &&
    a.payment === "Pendente" &&
    charge &&
    charge.gatewayStatus === "awaiting_payment" &&
    onSimulateGatewayPayment;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{a.psychologist}</h2>
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

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs text-slate-500">Data</dt>
          <dd className="font-medium text-slate-900">{formatAppointmentDatePt(a.isoDate)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Horário</dt>
          <dd className="font-medium text-slate-900">{a.time}</dd>
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
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">Sessão online</p>
          {a.videoCallLink ? (
            <a
              href={a.videoCallLink}
              target="_blank"
              rel="noopener noreferrer"
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

      {a.reminder ? (
        <p className="mt-3 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-800">{a.reminder}</p>
      ) : null}

      {!readOnly && !modCheck.ok && isAppointmentUpcoming(a) ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {modCheck.message}
        </p>
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
            onClick={() => onSimulateGatewayPayment!(a.chargeId!)}
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
          {charge ? (
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
              <p className="font-semibold text-slate-800">Registro financeiro (RF-009)</p>
              <p className="mt-1 text-slate-600">
                Cobrança: <code className="rounded bg-white px-1">{charge.id}</code> · Intent:{" "}
                <code className="rounded bg-white px-1">{charge.gatewayIntentId}</code>
              </p>
              <p className="mt-1 text-slate-600">
                Gateway: {charge.gatewayProvider} · Status:{" "}
                <span className="font-medium">
                  {charge.gatewayStatus === "awaiting_payment"
                    ? "aguardando pagamento"
                    : charge.gatewayStatus === "succeeded"
                      ? "pago"
                      : "falhou"}
                </span>
              </p>
            </div>
          ) : null}
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
