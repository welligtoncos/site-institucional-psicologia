"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  formatAppointmentDatePt,
} from "@/app/lib/portal-mocks";
import {
  joinPatientAppointmentRoom,
  leavePatientAppointmentRoom,
  listPatientAppointments,
  type ApiPatientAppointmentSummary,
} from "@/app/lib/portal-appointments-api";
import {
  clearSharedLiveSession,
  extractConsultaIdFromLiveRef,
  formatLiveElapsed,
  getSharedLiveSession,
  isPsychologistRoomEnteredActive,
  liveSessionRefsSameConsulta,
  setSharedLiveSession,
  subscribeSharedLiveSession,
  type SharedLiveSessionState,
} from "@/app/lib/live-session-shared";
import {
  isPastAgendaSlotEnd,
  scheduledSlotStillBlocks,
} from "@/app/lib/live-session-agenda";
import { todayIso } from "@/app/lib/psicologo-mocks";
import { openRoomRealtimeSocket } from "@/app/lib/room-realtime-ws";

function portalRef(id: string): string {
  return `portal:${id}`;
}

function statusShortLabel(s: LiveAppointment["status"]): string {
  if (s === "realizada") return "Concluída";
  if (s === "agendada") return "Agendada";
  if (s === "confirmada") return "Confirmada";
  if (s === "cancelada") return "Cancelada";
  if (s === "em_andamento") return "Em andamento";
  if (s === "nao_compareceu") return "Não compareceu";
  return s;
}

type LiveAppointment = {
  id: string;
  psychologist: string;
  psychologistCrp?: string;
  patientName?: string;
  specialty: string;
  isoDate: string;
  time: string;
  format: "Online" | "Presencial";
  price: number;
  durationMin: number;
  payment: "Pago" | "Pendente" | "Pagamento expirado";
  status: "agendada" | "confirmada" | "em_andamento" | "realizada" | "cancelada" | "nao_compareceu";
  videoCallLink?: string;
  psychologistOnline: boolean;
  sessionPhase?: "patient_waiting" | "live" | "ended";
  sessionStartedAt?: string;
};

type RealtimeRoomSnapshot = {
  psychologist_online: boolean;
  patient_online: boolean;
  meeting_link?: string | null;
  session_started: boolean;
  session_started_at?: string | null;
};

function mapApiAppointment(a: ApiPatientAppointmentSummary): LiveAppointment {
  return {
    id: a.id,
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
    psychologistOnline: Boolean(a.psychologist_online),
    sessionPhase: a.session_phase ?? undefined,
    sessionStartedAt: a.session_started_at ?? undefined,
  };
}

function isEligibleForLiveSession(a: LiveAppointment, todayIsoDate: string): boolean {
  if (a.isoDate < todayIsoDate) return false;
  if (a.format !== "Online") return false;
  if (a.payment !== "Pago") return false;
  return a.status === "confirmada" || a.status === "em_andamento";
}

type PatientLiveSessionBoardProps = {
  autoOpenAppointmentId?: string;
};

export function PatientLiveSessionBoard({ autoOpenAppointmentId }: PatientLiveSessionBoardProps) {
  const [today] = useState(() => todayIso());
  const [appointments, setAppointments] = useState<LiveAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [shared, setShared] = useState<SharedLiveSessionState | null>(null);
  const [newLinkRef, setNewLinkRef] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const prevWsSnapshot = useRef<Record<string, RealtimeRoomSnapshot>>({});
  const roomWsRef = useRef<WebSocket | null>(null);
  const roomWsAppointmentIdRef = useRef<string>("");
  const [roomRealtimeById, setRoomRealtimeById] = useState<Record<string, RealtimeRoomSnapshot>>({});
  const autoOpenTriedRef = useRef(false);
  /** Evita toast repetido se o WebSocket reenviar `session_started` com o mesmo instante. */
  const wsSessionStartedToastKeyRef = useRef<string>("");
  const apiLivePromotedToastKeyRef = useRef<string>("");

  const refresh = useCallback(async () => {
    const result = await listPatientAppointments(today);
    if (result.ok) {
      const mapped = result.data.appointments.map(mapApiAppointment);
      setAppointments(mapped);
      const currentShared = getSharedLiveSession();
      const activeId = currentShared ? extractConsultaIdFromLiveRef(currentShared.ref) : null;

      if (activeId) {
        const activeAppointment = mapped.find((item) => item.id === activeId);
        if (!activeAppointment) {
          /* Só limpa se a API devolveu lista não vazia — lista vazia pode ser falha transitória e apagaria a sessão na sala. */
          if (mapped.length > 0) {
            clearSharedLiveSession();
          }
        } else if (activeAppointment.status === "cancelada" || activeAppointment.status === "nao_compareceu") {
          clearSharedLiveSession();
        } else if (
          activeAppointment.status === "em_andamento" &&
          currentShared.phase !== "live" &&
          (Boolean(activeAppointment.sessionStartedAt?.trim()) || activeAppointment.sessionPhase === "live")
        ) {
          {
            const fromApi = activeAppointment.sessionStartedAt
              ? Date.parse(activeAppointment.sessionStartedAt)
              : NaN;
            const startedAtMs = Number.isFinite(fromApi) ? fromApi : currentShared.startedAtMs ?? Date.now();
            setSharedLiveSession({
              ...currentShared,
              phase: "live",
              ref: portalRef(activeId),
              meetUrl: activeAppointment.videoCallLink ?? currentShared.meetUrl,
              startedAtMs,
              updatedAtMs: Date.now(),
            });
          }
          const toastKey = `${activeId}|api-live`;
          if (apiLivePromotedToastKeyRef.current !== toastKey) {
            apiLivePromotedToastKeyRef.current = toastKey;
            toast.success("Sessão iniciada — cronômetro sincronizado.");
          }
        } else if (
          (activeAppointment.status === "realizada" || activeAppointment.sessionPhase === "ended") &&
          currentShared.phase !== "ended"
        ) {
          setSharedLiveSession({
            ...currentShared,
            phase: "ended",
            endedAtMs: Date.now(),
            updatedAtMs: Date.now(),
          });
        } else if (activeAppointment.videoCallLink?.trim()) {
          const nextMeet = activeAppointment.videoCallLink.trim();
          const curMeet = currentShared.meetUrl?.trim() ?? "";
          if (nextMeet !== curMeet) {
            if (currentShared.phase === "live" && currentShared.meetUrl?.trim()) {
              setNewLinkRef(currentShared.ref);
            }
            setSharedLiveSession({
              ...currentShared,
              ref: portalRef(activeId),
              meetUrl: nextMeet,
              updatedAtMs: Date.now(),
            });
          }
        } else if (
          activeAppointment.status === "em_andamento" &&
          currentShared.phase === "live" &&
          activeAppointment.sessionStartedAt
        ) {
          const fromApi = Date.parse(activeAppointment.sessionStartedAt);
          if (Number.isFinite(fromApi) && currentShared.startedAtMs !== fromApi) {
            setSharedLiveSession({
              ...currentShared,
              ref: portalRef(activeId),
              startedAtMs: fromApi,
              updatedAtMs: Date.now(),
            });
          }
        }
      } else {
        // Restaura sessão ao vivo quando o paciente reabre a tela sem estado local.
        const liveFromApi = mapped.find(
          (item) =>
            item.status === "em_andamento" &&
            item.format === "Online" &&
            Boolean(item.sessionStartedAt) &&
            item.sessionPhase !== "ended",
        );
        if (liveFromApi) {
          const parsedStartedAt = liveFromApi.sessionStartedAt ? Date.parse(liveFromApi.sessionStartedAt) : NaN;
          const startedAtMs = Number.isFinite(parsedStartedAt) ? parsedStartedAt : Date.now();
          const phase: SharedLiveSessionState["phase"] =
            liveFromApi.sessionPhase === "patient_waiting" ? "patient_waiting" : "live";
          const nextRef = portalRef(liveFromApi.id);
          const nextMeet = liveFromApi.videoCallLink?.trim() || undefined;
          const cur = getSharedLiveSession();
          if (
            cur &&
            liveSessionRefsSameConsulta(cur.ref, nextRef) &&
            cur.phase === phase &&
            (phase !== "live" || cur.startedAtMs === startedAtMs) &&
            (cur.meetUrl?.trim() || "") === (nextMeet ?? "") &&
            cur.isoDate === liveFromApi.isoDate &&
            cur.time === liveFromApi.time &&
            cur.durationMin === liveFromApi.durationMin &&
            cur.format === liveFromApi.format &&
            (cur.patientName?.trim() || "") === (liveFromApi.patientName?.trim() || `Paciente (consulta ${liveFromApi.id})`) &&
            (cur.psychologistName?.trim() || "") === (liveFromApi.psychologist?.trim() || "")
          ) {
            /* já alinhado — evita regravar a cada poll e o layout “piscar” na sala */
          } else {
            setSharedLiveSession({
              version: 1,
              ref: nextRef,
              phase,
              patientName: liveFromApi.patientName?.trim() || `Paciente (consulta ${liveFromApi.id})`,
              psychologistName: liveFromApi.psychologist,
              isoDate: liveFromApi.isoDate,
              time: liveFromApi.time,
              durationMin: liveFromApi.durationMin,
              format: liveFromApi.format,
              meetUrl: nextMeet,
              startedAtMs: phase === "live" ? startedAtMs : undefined,
              updatedAtMs: Date.now(),
            });
          }
        }
      }
    } else {
      setAppointments([]);
      toast.error(result.detail);
    }
    setLoading(false);
    setShared(getSharedLiveSession());
  }, [today]);

  /** Quando passa do horário de término marcado, libera o paciente para outra consulta sem depender só do fluxo manual. */
  useEffect(() => {
    const cur = getSharedLiveSession();
    if (!cur || cur.phase === "ended") return;
    if (!isPastAgendaSlotEnd(Date.now(), cur.isoDate, cur.time, cur.durationMin)) return;
    clearSharedLiveSession();
    setShared(null);
  }, [tick]);

  useEffect(() => {
    const roomRef = shared?.ref;
    if (!roomRef || !roomRef.startsWith("portal:")) {
      if (roomWsRef.current) roomWsRef.current.close();
      roomWsRef.current = null;
      roomWsAppointmentIdRef.current = "";
      return;
    }
    const appointmentId = roomRef.slice("portal:".length);
    if (!appointmentId) return;
    if (roomWsRef.current && roomWsAppointmentIdRef.current === appointmentId) return;
    if (roomWsRef.current) roomWsRef.current.close();

    const ws = openRoomRealtimeSocket(appointmentId, (event) => {
      const snapshot: RealtimeRoomSnapshot = {
        psychologist_online: Boolean(event.psychologist_online),
        patient_online: Boolean(event.patient_online),
        meeting_link: event.meeting_link ?? undefined,
        session_started: Boolean(event.session_started),
        session_started_at:
          typeof event.session_started_at === "string" && event.session_started_at.trim()
            ? event.session_started_at.trim()
            : undefined,
      };
      setRoomRealtimeById((prev) => ({ ...prev, [appointmentId]: snapshot }));
      const prev = prevWsSnapshot.current[appointmentId];
      if (prev) {
        if (!prev.psychologist_online && snapshot.psychologist_online) {
          toast.success("Psicólogo na sala.");
        } else if (prev.psychologist_online && !snapshot.psychologist_online) {
          toast.message("Psicólogo saiu da sala.");
        }
        if (!prev.meeting_link && snapshot.meeting_link) {
          toast.success("Link da chamada disponível.");
        }
      }
      const current = getSharedLiveSession();
      if (current && liveSessionRefsSameConsulta(current.ref, portalRef(appointmentId))) {
        if (snapshot.meeting_link && snapshot.meeting_link !== current.meetUrl) {
          if (current.phase === "live" && current.meetUrl?.trim()) {
            setNewLinkRef(current.ref);
          }
          setSharedLiveSession({
            ...current,
            meetUrl: snapshot.meeting_link,
            updatedAtMs: Date.now(),
          });
        }
        if (snapshot.session_started && current.phase !== "live") {
          const fromWs = snapshot.session_started_at ? Date.parse(snapshot.session_started_at) : NaN;
          const startedAtMs = Number.isFinite(fromWs) ? fromWs : current.startedAtMs ?? Date.now();
          setSharedLiveSession({
            ...current,
            phase: "live",
            startedAtMs,
            updatedAtMs: Date.now(),
          });
          const toastKey = `${appointmentId}|${snapshot.session_started_at ?? ""}|${startedAtMs}`;
          if (wsSessionStartedToastKeyRef.current !== toastKey) {
            wsSessionStartedToastKeyRef.current = toastKey;
            toast.success("Sessão iniciada.");
          }
        } else if (
          snapshot.session_started &&
          current.phase === "live" &&
          snapshot.session_started_at
        ) {
          const fromWs = Date.parse(snapshot.session_started_at);
          if (Number.isFinite(fromWs) && current.startedAtMs !== fromWs) {
            setSharedLiveSession({
              ...current,
              startedAtMs: fromWs,
              updatedAtMs: Date.now(),
            });
          }
        }
      }
      prevWsSnapshot.current[appointmentId] = snapshot;
    });
    roomWsRef.current = ws;
    roomWsAppointmentIdRef.current = appointmentId;
    return () => {
      if (roomWsRef.current) roomWsRef.current.close();
      roomWsRef.current = null;
      roomWsAppointmentIdRef.current = "";
    };
  }, [shared?.ref]);

  useEffect(() => {
    void refresh();
    const unsub = subscribeSharedLiveSession(() => {
      setShared(getSharedLiveSession());
    });
    const id = window.setInterval(() => setTick((x) => x + 1), 1000);
    const pollId = window.setInterval(() => {
      void refresh();
    }, 4000);
    const onBillingChanged = () => {
      void refresh();
    };
    window.addEventListener("portal-billing-changed", onBillingChanged);
    function onWindowFocus() {
      void refresh();
    }
    function onVisibilityChange() {
      if (document.visibilityState === "visible") void refresh();
    }
    window.addEventListener("focus", onWindowFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pageshow", onWindowFocus);
    return () => {
      unsub();
      window.clearInterval(id);
      window.clearInterval(pollId);
      window.removeEventListener("portal-billing-changed", onBillingChanged);
      window.removeEventListener("focus", onWindowFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pageshow", onWindowFocus);
    };
  }, [refresh]);

  /** Consultas online pagas e confirmadas (ou em andamento), qualquer profissional — alinhado ao portal real (UUID no psychId). */
  const eligibleSessions = useMemo(() => {
    return appointments
      .filter((a) => isEligibleForLiveSession(a, today))
      .sort((a, b) => {
        const d = a.isoDate.localeCompare(b.isoDate);
        if (d !== 0) return d;
        return a.time.localeCompare(b.time);
      });
  }, [appointments, today]);

  const selectedAppointmentId = autoOpenAppointmentId?.trim() || "";
  const visibleSessions = useMemo(() => {
    if (!selectedAppointmentId) return eligibleSessions;
    return eligibleSessions.filter((a) => a.id === selectedAppointmentId);
  }, [eligibleSessions, selectedAppointmentId]);

  async function handleEnterWaiting(apt: LiveAppointment) {
    const ref = portalRef(apt.id);
    const cur = getSharedLiveSession();
    const now = Date.now();
    if (cur && !liveSessionRefsSameConsulta(cur.ref, ref)) {
      if (scheduledSlotStillBlocks(cur.phase, cur.isoDate, cur.time, cur.durationMin, now)) {
        toast.error("Outra sessão ativa no horário marcado. Aguarde o fim do slot ou saia da fila.");
        return;
      }
      clearSharedLiveSession();
    }
    if (cur && liveSessionRefsSameConsulta(cur.ref, ref) && cur.phase === "patient_waiting") {
      toast.message("Você já está na fila.");
      return;
    }
    const join = await joinPatientAppointmentRoom(apt.id);
    if (!join.ok) {
      toast.error(join.detail);
      return;
    }
    const joinedAppointment = mapApiAppointment(join.data.appointment);
    setAppointments((prev) => prev.map((item) => (item.id === joinedAppointment.id ? joinedAppointment : item)));
    const meetUrl = join.data.join_url?.trim() || joinedAppointment.videoCallLink?.trim() || undefined;
    const next: SharedLiveSessionState = {
      version: 1,
      ref,
      phase: joinedAppointment.status === "em_andamento" ? "live" : "patient_waiting",
      patientName: joinedAppointment.patientName?.trim() || `Paciente (consulta ${joinedAppointment.id})`,
      psychologistName: joinedAppointment.psychologist,
      isoDate: joinedAppointment.isoDate,
      time: joinedAppointment.time,
      durationMin: joinedAppointment.durationMin,
      format: joinedAppointment.format,
      meetUrl,
      patientJoinedAtMs: Date.now(),
      startedAtMs: (() => {
        if (joinedAppointment.status !== "em_andamento" || !joinedAppointment.sessionStartedAt) return undefined;
        const t = Date.parse(joinedAppointment.sessionStartedAt);
        return Number.isFinite(t) ? t : undefined;
      })(),
      updatedAtMs: Date.now(),
    };
    setSharedLiveSession(next);
    toast.success("Na sala de espera.");
  }

  useEffect(() => {
    const appointmentId = autoOpenAppointmentId?.trim();
    if (!appointmentId || autoOpenTriedRef.current || loading) return;
    const apt = eligibleSessions.find((item) => item.id === appointmentId);
    if (!apt) {
      if (appointments.length > 0) {
        autoOpenTriedRef.current = true;
        toast.error("Consulta online não disponível para entrada agora.");
      }
      return;
    }
    autoOpenTriedRef.current = true;
    void handleEnterWaiting(apt);
  }, [autoOpenAppointmentId, eligibleSessions, loading, appointments.length]);

  /** Sai da sala de espera sem encerrar consulta no portal — pode entrar de novo quando quiser. */
  async function handleLeaveWaitingRoom(apt: LiveAppointment) {
    const ref = portalRef(apt.id);
    const cur = getSharedLiveSession();
    if (!cur || !liveSessionRefsSameConsulta(cur.ref, ref) || cur.phase !== "patient_waiting") {
      toast.message("Nada para sair nesta consulta.");
      return;
    }
    const leave = await leavePatientAppointmentRoom(apt.id);
    if (!leave.ok) {
      toast.error(leave.detail);
      return;
    }
    clearSharedLiveSession();
    setShared(null);
    await refresh();
    toast.success("Saiu da fila. Pode entrar de novo quando quiser.");
  }

  function handleDismissEnded() {
    clearSharedLiveSession();
    setShared(null);
  }

  const elapsedMs = useMemo(() => {
    if (shared?.phase !== "live" || !shared.startedAtMs) return 0;
    return Math.max(0, Date.now() - shared.startedAtMs);
  }, [shared?.phase, shared?.startedAtMs, tick]);
  const plannedMs = shared ? shared.durationMin * 60 * 1000 : 0;
  const progressPct =
    shared?.phase === "live" && plannedMs > 0 ? Math.min(100, (elapsedMs / plannedMs) * 100) : 0;

  return (
    <div id="portal-live-room" className="space-y-8">
      <section className="rounded-2xl border border-sky-100 bg-gradient-to-r from-sky-50 to-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-800">Atendimento ao vivo</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Atendimento online</h1>
        <p className="mt-2 max-w-xl text-sm text-slate-600">
          Aqui aparecem apenas consultas online com pagamento confirmado e status de confirmada ou em andamento. A sessão respeita o
          horário e a duração definidos na agenda; quando esse período termina, você pode acessar normalmente a próxima consulta.
        </p>
      </section>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-slate-700">Carregando consultas…</p>
        </div>
      ) : visibleSessions.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-slate-700">
            {selectedAppointmentId
              ? "A sessão selecionada não está disponível para entrada agora."
              : "Nenhuma consulta online paga e confirmada (ou em andamento) a partir de hoje."}
          </p>
          <p className="mt-3 text-xs text-slate-500">
            {selectedAppointmentId ? (
              <>
                Verifique pagamento, status da consulta e horário da sessão em{" "}
                <strong className="font-medium text-slate-700">Minhas consultas</strong>.
              </>
            ) : (
              <>
                Regularize em <strong className="font-medium text-slate-700">Minhas consultas</strong> ou agende de novo. Presencial não
                usa esta sala.
              </>
            )}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              href="/portal/consultas"
              className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-900 hover:bg-sky-100"
            >
              Minhas consultas
            </Link>
            <Link
              href="/portal/agendar"
              className="inline-flex rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
            >
              Agendar consulta
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {visibleSessions.map((apt) => {
            const ref = portalRef(apt.id);
            const isThis = shared ? liveSessionRefsSameConsulta(shared.ref, ref) : false;
            const phase = isThis ? shared?.phase : null;

            return (
              <article
                key={apt.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="px-5 py-6 sm:px-6">
                  <div className="overflow-hidden rounded-2xl border-2 border-sky-200 bg-gradient-to-b from-sky-50/50 via-white to-white shadow-inner">
                    <div className="border-b border-sky-100/90 bg-sky-600/5 px-5 py-4 sm:px-6">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-800">Sessão online</p>
                      <div className="mt-2 min-w-0">
                        <p className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
                          {formatAppointmentDatePt(apt.isoDate)} · {apt.time}
                          {apt.isoDate === today ? (
                            <span className="ml-2 align-middle rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-sky-900">
                              Hoje
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-800">{apt.psychologist}</p>
                        <p className="mt-0.5 text-xs text-slate-600">
                          {apt.psychologistCrp ? <>CRP {apt.psychologistCrp} · </> : null}
                          {apt.format} · {statusShortLabel(apt.status)}
                        </p>
                      </div>
                    </div>

                    <div className="px-5 py-6 sm:px-6">
                      {!isThis || !phase ? (
                        <div className="space-y-3">
                          <p className="text-sm text-slate-600">
                            {apt.status === "em_andamento"
                              ? "Consulta em andamento. Volte para a sala para continuar do mesmo ponto."
                              : "Na hora, entre na fila. Acompanhe link e cronômetro abaixo."}
                          </p>
                          <button
                            type="button"
                            onClick={() => handleEnterWaiting(apt)}
                            disabled={Boolean(
                              shared &&
                                !liveSessionRefsSameConsulta(shared.ref, ref) &&
                                scheduledSlotStillBlocks(shared.phase, shared.isoDate, shared.time, shared.durationMin, Date.now()),
                            )}
                            className="rounded-full bg-sky-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-sky-900/10 hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {apt.status === "em_andamento" ? "Voltar para sala" : "Entrar na fila"}
                          </button>
                          {shared &&
                          !liveSessionRefsSameConsulta(shared.ref, ref) &&
                          scheduledSlotStillBlocks(shared.phase, shared.isoDate, shared.time, shared.durationMin, Date.now()) ? (
                            <p className="text-xs text-amber-800">
                              Há outra sessão dentro do horário marcado na agenda — aguarde o fim do slot ou saia da fila.
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      {isThis && phase === "patient_waiting" && shared ? (
                        <div className="space-y-6">
                          {(() => {
                            const wsSnapshot = roomRealtimeById[apt.id];
                            const stepPsychologistEntered =
                              Boolean(wsSnapshot?.psychologist_online) ||
                              isPsychologistRoomEnteredActive(`appointment:${apt.id}`) ||
                              apt.psychologistOnline ||
                              apt.status === "em_andamento" ||
                              Boolean(apt.sessionStartedAt) ||
                              shared.phase === "live";
                            const currentMeetUrl =
                              shared.meetUrl?.trim() ||
                              wsSnapshot?.meeting_link?.trim() ||
                              apt.videoCallLink?.trim() ||
                              "";
                            const stepProfessionalReady = stepPsychologistEntered && Boolean(currentMeetUrl);
                            const stepSessionStarted =
                              Boolean(wsSnapshot?.session_started) ||
                              shared.phase === "live" ||
                              (apt.status === "em_andamento" && Boolean(apt.sessionStartedAt));
                            const currentStepLabel = !stepPsychologistEntered
                              ? "Aguardando psicólogo"
                              : !stepProfessionalReady
                                ? "Aguardando link da chamada"
                                : !stepSessionStarted
                                  ? "Pode entrar na videochamada"
                                  : "Sessão em andamento";
                            return (
                              <>
                          <div className="overflow-hidden rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-slate-50/80 px-5 py-6 text-center shadow-sm">
                            <div
                              className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sky-600 text-white shadow-lg shadow-sky-900/20"
                              aria-hidden
                            >
                              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <p className="mt-4 text-lg font-bold tracking-tight text-slate-900">Na fila</p>
                            <p className="mt-1 text-sm text-slate-600">
                              Com <strong className="font-semibold text-slate-800">{shared.psychologistName}</strong>
                            </p>
                            <p className="mt-3 rounded-lg border border-sky-100 bg-white/90 px-3 py-2 text-xs text-slate-600">
                              Presença → link → cronômetro (mesmo fluxo do psicólogo).
                            </p>
                          </div>

                          <div className="rounded-xl border border-slate-200 bg-slate-50/90 px-4 py-6 text-center">
                            <div className="mx-auto mb-3 flex h-14 w-14 animate-pulse items-center justify-center rounded-full bg-sky-200 text-2xl text-sky-900">
                              ◉
                            </div>
                            <p className="font-semibold text-slate-900">Aguardando</p>
                            <p className="mt-2 text-xs font-semibold text-sky-800">{currentStepLabel}</p>
                            <p className="sr-only">Progresso: psicólogo na sala, link ou sessão iniciada.</p>
                            <div className="mx-auto mt-4 max-w-2xl" role="tablist" aria-label="Etapas do atendimento">
                              <div className="grid grid-cols-3 gap-2">
                                <div
                                  className={`rounded-xl border px-2 py-2.5 text-left transition ${
                                    stepPsychologistEntered
                                      ? "border-sky-300 bg-sky-100 text-sky-950 shadow-sm"
                                      : "border-slate-200 bg-white text-slate-500"
                                  }`}
                                >
                                  <p className="text-[10px] font-bold uppercase tracking-wide">1</p>
                                  <p className="mt-1 text-[11px] font-semibold leading-snug">Psicólogo na sala</p>
                                </div>
                                <div
                                  className={`rounded-xl border px-2 py-2.5 text-left transition ${
                                    stepProfessionalReady
                                      ? "border-sky-300 bg-sky-100 text-sky-950 shadow-sm"
                                      : "border-slate-200 bg-white text-slate-500"
                                  }`}
                                >
                                  <p className="text-[10px] font-bold uppercase tracking-wide">2</p>
                                  <p className="mt-1 text-[11px] font-semibold leading-snug">Link da chamada</p>
                                </div>
                                <div
                                  className={`rounded-xl border px-2 py-2.5 text-left transition ${
                                    stepSessionStarted
                                      ? "border-sky-600 bg-sky-600 text-white shadow-sm"
                                      : "border-slate-200 bg-white text-slate-500"
                                  }`}
                                >
                                  <p className="text-[10px] font-bold uppercase tracking-wide">3</p>
                                  <p className="mt-1 text-[11px] font-semibold leading-snug">Cronômetro</p>
                                </div>
                              </div>
                            </div>
                            <p className="mx-auto mt-4 max-w-lg text-sm text-slate-700">
                              <span className="font-medium text-slate-900">O cronômetro só inicia quando o psicólogo der play.</span>{" "}
                              {!stepPsychologistEntered ? (
                                <>Aguardando <strong>{shared.psychologistName}</strong>.</>
                              ) : !stepProfessionalReady ? (
                                <>Psicólogo na sala — aguarde o link.</>
                              ) : (
                                <>
                                  Entre na chamada abaixo. O tempo oficial aparece aqui quando <strong>{shared.psychologistName}</strong>{" "}
                                  iniciar no painel.
                                </>
                              )}
                            </p>
                            {stepProfessionalReady ? (
                              <div className="mt-5 rounded-xl border border-sky-200 bg-white px-4 py-4 text-left shadow-sm">
                                <p className="text-xs font-semibold text-sky-900">Link pronto — abra a chamada.</p>
                                <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">URL</p>
                                <p className="mt-2 break-all font-mono text-xs text-slate-800">
                                  {currentMeetUrl}
                                </p>
                                <div className="mt-4 flex flex-wrap gap-2">
                                  <a
                                    href={currentMeetUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex rounded-full bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700"
                                  >
                                    Abrir chamada
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      void navigator.clipboard
                                        .writeText(currentMeetUrl)
                                        .then(() =>
                                        toast.success("Link copiado."),
                                        );
                                    }}
                                    className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                                  >
                                    Copiar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="mt-4 text-xs text-slate-500">O link aparece quando o psicólogo publicar no painel.</p>
                            )}
                            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 border-t border-slate-200 pt-5">
                              <button
                                type="button"
                                onClick={() => handleLeaveWaitingRoom(apt)}
                                className="rounded-full border border-slate-400 bg-white px-6 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                              >
                                Sair da fila
                              </button>
                            </div>
                            <p className="mt-3 text-center text-[11px] text-slate-500">
                              Atualização automática. Sair remove você da fila.
                            </p>
                          </div>
                              </>
                            );
                          })()}
                        </div>
                      ) : null}

                      {isThis && phase === "live" && shared?.startedAtMs ? (
                        <div className="overflow-hidden rounded-2xl border-2 border-sky-200 bg-gradient-to-b from-white to-sky-50/40 shadow-inner">
                          <div className="border-b border-sky-100 bg-sky-50/80 px-5 py-4 sm:px-6">
                            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-sky-900">Em andamento</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">{shared.psychologistName}</p>
                            <p className="text-xs text-slate-600">
                              {shared.time} · {shared.format} · {shared.durationMin} min
                            </p>
                          </div>
                          <div className="px-4 py-8 text-center sm:px-6">
                            <div
                              className="mx-auto grid max-w-lg grid-cols-3 gap-1 rounded-xl border border-sky-200/80 bg-white/90 p-1 text-[10px] font-bold uppercase leading-tight tracking-wide text-sky-900/70 sm:text-[11px]"
                              role="tablist"
                              aria-label="Etapas do atendimento"
                            >
                              <span className="rounded-lg bg-sky-100/90 px-1 py-2.5 text-sky-900 sm:px-2">1 · Psicólogo</span>
                              <span className="rounded-lg bg-sky-100/90 px-1 py-2.5 text-sky-900 sm:px-2">2 · Link</span>
                              <span className="rounded-lg bg-sky-600 px-1 py-2.5 text-white shadow-sm sm:px-2">3 · Ao vivo</span>
                            </div>
                            <p className="mx-auto mt-4 max-w-lg text-sm text-slate-800">
                              Cronômetro igual ao do psicólogo. A chamada pode ficar em outra aba.
                            </p>
                            {shared.meetUrl ? (
                              <div className="mx-auto mt-2 w-full max-w-lg rounded-xl border border-slate-200 bg-white px-3 py-3 text-left">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Link da chamada</p>
                                  {newLinkRef === ref ? (
                                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-900">
                                      Link novo
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-2 break-all font-mono text-xs text-slate-800">{shared.meetUrl}</p>
                                <div className="mt-3">
                                  <a
                                    href={shared.meetUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => setNewLinkRef(null)}
                                    className="font-semibold text-sky-800 underline"
                                  >
                                    Abrir videochamada
                                  </a>
                                </div>
                              </div>
                            ) : null}
                            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Tempo decorrido</p>
                            <p className="mt-2 font-mono text-5xl font-bold tabular-nums text-sky-900 sm:text-6xl">
                              {formatLiveElapsed(elapsedMs)}
                            </p>
                            <div className="mx-auto mt-6 h-2 max-w-xs overflow-hidden rounded-full bg-slate-200">
                              <div
                                className="h-full rounded-full bg-sky-500 transition-[width] duration-1000 ease-linear"
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {isThis && phase === "ended" && shared?.endedAtMs ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center">
                          <p className="text-lg font-semibold text-slate-900">Sessão encerrada</p>
                          <p className="mt-2 text-sm text-slate-700">
                            Finalizada às{" "}
                            {new Date(shared.endedAtMs).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                            .
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Duração: {shared.startedAtMs ? formatLiveElapsed(shared.endedAtMs - shared.startedAtMs) : "—"}
                          </p>
                          <button
                            type="button"
                            onClick={handleDismissEnded}
                            className="mt-5 rounded-full bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-sky-700"
                          >
                            Fechar
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
