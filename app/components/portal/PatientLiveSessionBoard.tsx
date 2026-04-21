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
  getSharedLiveSession,
  isPsychologistRoomEnteredActive,
  setSharedLiveSession,
  subscribeSharedLiveSession,
  type SharedLiveSessionState,
} from "@/app/lib/live-session-shared";
import { todayIso } from "@/app/lib/psicologo-mocks";
import { openRoomRealtimeSocket } from "@/app/lib/room-realtime-ws";

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const min = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;
  if (h > 0) return `${h}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

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
  payment: "Pago" | "Pendente";
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

export function PatientLiveSessionBoard() {
  const [today] = useState(() => todayIso());
  const [appointments, setAppointments] = useState<LiveAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [shared, setShared] = useState<SharedLiveSessionState | null>(null);
  const [tick, setTick] = useState(0);
  const prevPsychOnline = useRef<Record<string, boolean>>({});
  const prevMeetReady = useRef<Record<string, boolean>>({});
  const prevPsychEnteredRealtime = useRef<Record<string, boolean>>({});
  const prevWsSnapshot = useRef<Record<string, RealtimeRoomSnapshot>>({});
  const roomWsRef = useRef<WebSocket | null>(null);
  const roomWsAppointmentIdRef = useRef<string>("");
  const sharedRef = useRef<SharedLiveSessionState | null>(null);
  const [roomRealtimeById, setRoomRealtimeById] = useState<Record<string, RealtimeRoomSnapshot>>({});

  const refresh = useCallback(async () => {
    const result = await listPatientAppointments(today);
    if (result.ok) {
      const mapped = result.data.appointments.map(mapApiAppointment);
      setAppointments(mapped);
      const currentShared = getSharedLiveSession();
      if (currentShared?.ref.startsWith("portal:")) {
        const activeId = currentShared.ref.slice("portal:".length);
        const activeAppointment = mapped.find((item) => item.id === activeId);
        if (activeAppointment) {
          if (
            activeAppointment.status === "em_andamento" &&
            currentShared.phase !== "live"
          ) {
            setSharedLiveSession({
              ...currentShared,
              phase: "live",
              meetUrl: activeAppointment.videoCallLink ?? currentShared.meetUrl,
              startedAtMs: activeAppointment.sessionStartedAt
                ? Date.parse(activeAppointment.sessionStartedAt)
                : Date.now(),
              updatedAtMs: Date.now(),
            });
            toast.success("Psicólogo iniciou a sessão. Cronômetro oficial em andamento.");
          } else if (
            activeAppointment.status === "realizada" &&
            currentShared.phase !== "ended"
          ) {
            setSharedLiveSession({
              ...currentShared,
              phase: "ended",
              endedAtMs: Date.now(),
              updatedAtMs: Date.now(),
            });
          } else if (
            activeAppointment.videoCallLink &&
            activeAppointment.videoCallLink !== currentShared.meetUrl
          ) {
            setSharedLiveSession({
              ...currentShared,
              meetUrl: activeAppointment.videoCallLink,
              updatedAtMs: Date.now(),
            });
          }
        }
      }
      const currentMap = Object.fromEntries(mapped.map((item) => [item.id, item.psychologistOnline]));
      const currentMeetMap = Object.fromEntries(mapped.map((item) => [item.id, Boolean(item.videoCallLink?.trim())]));
      const currentPsychEnteredMap = Object.fromEntries(
        mapped.map((item) => [`appointment:${item.id}`, isPsychologistRoomEnteredActive(`appointment:${item.id}`)]),
      );
      const liveShared = sharedRef.current;
      if (liveShared?.phase === "patient_waiting" && liveShared.ref.startsWith("portal:")) {
        const currentId = liveShared.ref.slice("portal:".length);
        const liveAppointmentRef = `appointment:${currentId}`;
        const wasOnline = prevPsychOnline.current[currentId] ?? false;
        const nowOnline = currentMap[currentId] ?? false;
        const wasMeetReady = prevMeetReady.current[currentId] ?? false;
        const nowMeetReady = currentMeetMap[currentId] ?? false;
        const wasPsychEntered = prevPsychEnteredRealtime.current[liveAppointmentRef] ?? false;
        const nowPsychEntered = currentPsychEnteredMap[liveAppointmentRef] ?? false;
        const wasStepOneActive = wasOnline || wasPsychEntered;
        const nowStepOneActive = nowOnline || nowPsychEntered;
        if (!wasOnline && nowOnline) {
          toast.success("Seu psicólogo entrou na sala. Você já pode iniciar o atendimento.");
        } else if (!wasPsychEntered && nowPsychEntered) {
          toast.success("Psicólogo entrou na sala. Aguarde o link para entrar na chamada.");
        } else if (wasStepOneActive && !nowStepOneActive) {
          toast.message("Psicólogo saiu da sala. As etapas voltaram para aguardar entrada.");
        } else if (!wasMeetReady && nowMeetReady) {
          toast.success("Seu psicólogo está pronto. Link da sala disponível para entrar.");
        }
      }
      prevPsychOnline.current = currentMap;
      prevMeetReady.current = currentMeetMap;
      prevPsychEnteredRealtime.current = currentPsychEnteredMap;
    } else {
      setAppointments([]);
      toast.error(result.detail);
    }
    setLoading(false);
    setShared(getSharedLiveSession());
  }, [today]);

  useEffect(() => {
    sharedRef.current = shared;
  }, [shared]);

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
      };
      setRoomRealtimeById((prev) => ({ ...prev, [appointmentId]: snapshot }));
      const prev = prevWsSnapshot.current[appointmentId];
      if (!prev?.psychologist_online && snapshot.psychologist_online) {
        toast.success("Seu psicólogo entrou na sala.");
      } else if (prev?.psychologist_online && !snapshot.psychologist_online) {
        toast.message("Psicólogo saiu da sala.");
      }
      if (!prev?.meeting_link && snapshot.meeting_link) {
        toast.success("Link da videochamada disponível.");
      }
      const current = getSharedLiveSession();
      if (current?.ref === `portal:${appointmentId}`) {
        if (snapshot.meeting_link && snapshot.meeting_link !== current.meetUrl) {
          setSharedLiveSession({
            ...current,
            meetUrl: snapshot.meeting_link,
            updatedAtMs: Date.now(),
          });
        }
        if (snapshot.session_started && current.phase !== "live") {
          setSharedLiveSession({
            ...current,
            phase: "live",
            startedAtMs: Date.now(),
            updatedAtMs: Date.now(),
          });
          toast.success("Sessão iniciada em tempo real.");
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
    }, 1000);
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

  async function handleEnterWaiting(apt: LiveAppointment) {
    const ref = portalRef(apt.id);
    const cur = getSharedLiveSession();
    if (cur && cur.phase !== "ended" && cur.ref !== ref) {
      toast.error("Já existe outra sessão ativa na demonstração. Aguarde ou finalize a outra aba.");
      return;
    }
    if (cur && cur.ref === ref && cur.phase === "patient_waiting") {
      toast.message("Você já está na sala de espera.");
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
      startedAtMs:
        joinedAppointment.sessionStartedAt && joinedAppointment.status === "em_andamento"
          ? Date.parse(joinedAppointment.sessionStartedAt)
          : undefined,
      updatedAtMs: Date.now(),
    };
    setSharedLiveSession(next);
    toast.success("Você entrou na sala com dados reais da consulta.");
  }

  /** Sai da sala de espera sem encerrar consulta no portal — pode entrar de novo quando quiser. */
  async function handleLeaveWaitingRoom(apt: LiveAppointment) {
    const ref = portalRef(apt.id);
    const cur = getSharedLiveSession();
    if (!cur || cur.ref !== ref || cur.phase !== "patient_waiting") {
      toast.message("Não há sala de espera ativa para sair.");
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
    toast.success("Você saiu da sala de espera. Pode voltar a qualquer momento clicando em Entrar novamente.");
  }

  function handleDismissEnded() {
    clearSharedLiveSession();
    setShared(null);
  }

  const elapsedMs = useMemo(() => {
    if (shared?.phase !== "live" || !shared.startedAtMs) return 0;
    return Date.now() - shared.startedAtMs;
  }, [shared, tick]);
  const plannedMs = shared ? shared.durationMin * 60 * 1000 : 0;
  const progressPct =
    shared?.phase === "live" && plannedMs > 0 ? Math.min(100, (elapsedMs / plannedMs) * 100) : 0;

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-sky-100 bg-gradient-to-r from-sky-50 to-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-800">Atendimento ao vivo</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Entrar no atendimento</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          Aparecem aqui só consultas <strong className="font-semibold text-slate-800">online</strong>, já{" "}
          <strong className="font-semibold text-slate-800">pagas</strong> e com status{" "}
          <strong className="font-semibold text-slate-800">confirmada</strong> ou{" "}
          <strong className="font-semibold text-slate-800">em andamento</strong> (hoje ou data futura). Primeiro você{" "}
          <strong className="font-semibold text-slate-800">aguarda o link</strong> que o psicólogo envia pelo painel; quando o link
          aparecer aqui, o profissional está pronto na sala. Depois do <strong className="font-semibold text-slate-800">play</strong>{" "}
          no painel dele, esta página mostra a sessão com o cronômetro.
        </p>
      </section>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-slate-700">Carregando consultas reais do portal...</p>
        </div>
      ) : eligibleSessions.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-slate-700">
            Nenhuma consulta <strong className="font-semibold text-slate-900">online</strong>,{" "}
            <strong className="font-semibold text-slate-900">paga</strong> e{" "}
            <strong className="font-semibold text-slate-900">confirmada</strong> (ou em andamento) para hoje ou datas futuras.
          </p>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            Conclua o pagamento em <strong className="font-medium text-slate-700">Minhas consultas</strong> ou no fluxo de agendamento;
            atendimentos presenciais não entram nesta sala virtual.
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
          {eligibleSessions.map((apt) => {
            const ref = portalRef(apt.id);
            const isThis = shared?.ref === ref;
            const phase = isThis ? shared?.phase : null;

            return (
              <article
                key={apt.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="px-5 py-6 sm:px-6">
                  <div className="overflow-hidden rounded-2xl border-2 border-sky-200 bg-gradient-to-b from-sky-50/50 via-white to-white shadow-inner">
                    <div className="border-b border-sky-100/90 bg-sky-600/5 px-5 py-4 sm:px-6">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-sky-800">Nesta sala</p>
                      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
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
                        <div className="flex flex-wrap justify-end gap-2">
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-900">
                            Pago · pronto para sala
                          </span>
                          {apt.videoCallLink?.trim() ? (
                            <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-900">
                              Link da consulta disponível
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <p className="mt-3 text-xs leading-relaxed text-slate-600">
                        Mesmo layout da sala do psicólogo em <strong className="font-medium text-slate-800">/psicologo/sessao</strong>:
                        aguarde o link, use a videochamada e acompanhe o cronômetro após o play.
                      </p>
                    </div>

                    <div className="px-5 py-6 sm:px-6">
                      {!isThis || !phase ? (
                        <div className="space-y-3">
                          <p className="text-sm leading-relaxed text-slate-600">
                            Quando for a hora, entre na sala de espera. Você acompanha os passos abaixo (como no painel do
                            profissional), até o link aparecer e a sessão iniciar com o cronômetro.
                          </p>
                          <button
                            type="button"
                            onClick={() => handleEnterWaiting(apt)}
                            disabled={Boolean(shared && shared.phase !== "ended" && shared.ref !== ref)}
                            className="rounded-full bg-sky-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-sky-900/10 hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Entrar na sala de espera
                          </button>
                          {shared && shared.phase !== "ended" && shared.ref !== ref ? (
                            <p className="text-xs text-amber-800">
                              Outra consulta está em uso na demonstração. Finalize-a antes.
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
                              ? "Etapa atual: aguardando psicólogo entrar na sala"
                              : !stepProfessionalReady
                                ? "Etapa atual: psicólogo entrou, aguardando link da sala"
                                : !stepSessionStarted
                                  ? "Etapa atual: profissional pronto, você já pode entrar na sala"
                                  : "Etapa atual: sessão iniciada, cronômetro em andamento";
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
                            <p className="mt-4 text-lg font-bold tracking-tight text-slate-900">Você entrou na sala</p>
                            <p className="mt-1 text-sm leading-relaxed text-slate-600">
                              Sala virtual · <strong className="font-semibold text-slate-800">{shared.psychologistName}</strong>
                            </p>
                            <p className="mt-3 rounded-lg border border-sky-100 bg-white/90 px-3 py-2 text-xs leading-relaxed text-slate-600">
                              Abaixo, o mesmo fluxo em etapas visto pelo psicólogo: link → presença na fila → sessão com tempo
                              oficial.
                            </p>
                          </div>

                          <div className="rounded-xl border border-slate-200 bg-slate-50/90 px-4 py-6 text-center">
                            <div className="mx-auto mb-3 flex h-14 w-14 animate-pulse items-center justify-center rounded-full bg-sky-200 text-2xl text-sky-900">
                              ◉
                            </div>
                            <p className="font-semibold text-slate-900">Sala de espera</p>
                            <p className="mt-2 text-xs font-semibold text-sky-800">{currentStepLabel}</p>
                            <p className="sr-only">Estado do fluxo: aguardando link, profissional pronto ou sessão iniciada.</p>
                            <div className="mx-auto mt-4 max-w-2xl" role="tablist" aria-label="Progresso do atendimento">
                              <div className="grid grid-cols-3 gap-2">
                                <div
                                  className={`rounded-xl border px-2 py-2.5 text-left transition ${
                                    stepPsychologistEntered
                                      ? "border-sky-300 bg-sky-100 text-sky-950 shadow-sm"
                                      : "border-slate-200 bg-white text-slate-500"
                                  }`}
                                >
                                  <p className="text-[10px] font-bold uppercase tracking-wide">Etapa 1</p>
                                  <p className="mt-1 text-[11px] font-semibold leading-snug">Psicólogo entrou na sala</p>
                                </div>
                                <div
                                  className={`rounded-xl border px-2 py-2.5 text-left transition ${
                                    stepProfessionalReady
                                      ? "border-sky-300 bg-sky-100 text-sky-950 shadow-sm"
                                      : "border-slate-200 bg-white text-slate-500"
                                  }`}
                                >
                                  <p className="text-[10px] font-bold uppercase tracking-wide">Etapa 2</p>
                                  <p className="mt-1 text-[11px] font-semibold leading-snug">Profissional pronto: entre na sala</p>
                                </div>
                                <div
                                  className={`rounded-xl border px-2 py-2.5 text-left transition ${
                                    stepSessionStarted
                                      ? "border-sky-600 bg-sky-600 text-white shadow-sm"
                                      : "border-slate-200 bg-white text-slate-500"
                                  }`}
                                >
                                  <p className="text-[10px] font-bold uppercase tracking-wide">Etapa 3</p>
                                  <p className="mt-1 text-[11px] font-semibold leading-snug">Psicólogo inicia (cronômetro)</p>
                                </div>
                              </div>
                            </div>
                            <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-slate-700">
                              <strong className="text-slate-900">Só esta espera não liga o cronômetro.</strong>{" "}
                              {!stepPsychologistEntered ? (
                                <>
                                  Aguardando <strong>{shared.psychologistName}</strong> entrar na sala.
                                </>
                              ) : !stepProfessionalReady ? (
                                <>
                                  O psicólogo já entrou. Aguarde ele publicar o link da chamada para você entrar na sala.
                                </>
                              ) : (
                                <>
                                  <strong>{shared.psychologistName}</strong> está pronto. Entre agora na Meet/Zoom; quando o
                                  profissional <strong className="text-slate-900">der play no painel</strong>, esta página mostra o
                                  tempo oficial da sessão.
                                </>
                              )}
                            </p>
                            {stepProfessionalReady ? (
                              <div className="mt-5 rounded-xl border border-sky-200 bg-white px-4 py-4 text-left shadow-sm">
                                <p className="text-xs font-semibold text-sky-900">
                                  Profissional pronto — entre na sala com o link abaixo.
                                </p>
                                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                                  Link da videochamada
                                </p>
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
                                    Abrir na nova aba
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
                              <p className="mt-4 text-xs text-slate-500">
                                O link surge aqui quando o psicólogo salvar no painel dele (mesmo estado da sala do profissional).
                              </p>
                            )}
                            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 border-t border-slate-200 pt-5">
                              <button
                                type="button"
                                onClick={() => handleLeaveWaitingRoom(apt)}
                                className="rounded-full border border-slate-400 bg-white px-6 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                              >
                                Sair da sala de espera
                              </button>
                            </div>
                            <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                              Atualização automática. Sair remove você da fila neste dispositivo (demo).
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
                            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-sky-900">
                              Em andamento · sincronizado
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">{shared.psychologistName}</p>
                            <p className="text-xs text-slate-600">
                              {shared.time} · {shared.format} · {shared.durationMin} min
                            </p>
                          </div>
                          <div className="px-4 py-8 text-center sm:px-6">
                            <div
                              className="mx-auto grid max-w-lg grid-cols-3 gap-1 rounded-xl border border-sky-200/80 bg-white/90 p-1 text-[10px] font-bold uppercase leading-tight tracking-wide text-sky-900/70 sm:text-[11px]"
                              role="tablist"
                              aria-label="Progresso do atendimento"
                            >
                              <span className="rounded-lg bg-sky-100/90 px-1 py-2.5 text-sky-900 sm:px-2">
                                1 · Psicólogo entrou na sala
                              </span>
                              <span className="rounded-lg bg-sky-100/90 px-1 py-2.5 text-sky-900 sm:px-2">
                                2 · Profissional pronto: entre na sala
                              </span>
                              <span className="rounded-lg bg-sky-600 px-1 py-2.5 text-white shadow-sm sm:px-2">
                                3 · Psicólogo inicia (cronômetro)
                              </span>
                            </div>
                            <p className="mx-auto mt-4 max-w-lg text-sm font-semibold leading-snug text-slate-900">
                              <strong>Sessão iniciada</strong> — o mesmo cronômetro do painel do profissional. Você pode seguir na
                              Meet/Zoom nesta ou em outra aba.
                            </p>
                            {shared.meetUrl ? (
                              <p className="mx-auto mt-3 max-w-lg text-xs text-slate-600">
                                Link da chamada:{" "}
                                <a
                                  href={shared.meetUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-semibold text-sky-800 underline"
                                >
                                  abrir na nova aba
                                </a>
                              </p>
                            ) : null}
                            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-sky-800">
                              Atendimento em andamento · tempo oficial
                            </p>
                            <p className="mt-4 font-mono text-5xl font-bold tabular-nums text-sky-900 sm:text-6xl">
                              {formatElapsed(elapsedMs)}
                            </p>
                            <div className="mx-auto mt-6 h-2 max-w-xs overflow-hidden rounded-full bg-slate-200">
                              <div
                                className="h-full rounded-full bg-sky-500 transition-[width] duration-1000 ease-linear"
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                            <p className="mt-4 text-xs text-slate-600">
                              Tempo sincronizado com o psicólogo neste navegador (demonstração).
                            </p>
                          </div>
                        </div>
                      ) : null}

                      {isThis && phase === "ended" && shared?.endedAtMs ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center">
                          <p className="text-lg font-semibold text-slate-900">Sessão encerrada</p>
                          <p className="mt-2 text-sm text-slate-700">
                            O psicólogo finalizou o atendimento às{" "}
                            {new Date(shared.endedAtMs).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                            .
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Duração registrada no mock:{" "}
                            {shared.startedAtMs ? formatElapsed(shared.endedAtMs - shared.startedAtMs) : "—"}
                          </p>
                          <button
                            type="button"
                            onClick={handleDismissEnded}
                            className="mt-5 rounded-full bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-sky-700"
                          >
                            Ok, entendi
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

      <p className="text-center text-xs text-slate-500">
        Em produção, use vídeo seguro e backend próprio. Para ver o mesmo estado que o psicólogo neste demo, use o mesmo URL em
        todas as abas (ex.: só localhost:3000, não misturar com 127.0.0.1).{" "}
        <Link href="/portal/consultas" className="font-medium text-sky-700 underline">
          Consultas
        </Link>
        {" · "}
        <Link href="/psicologo/sessao" className="font-medium text-sky-700 underline">
          Sala do psicólogo
        </Link>
      </p>
    </div>
  );
}
