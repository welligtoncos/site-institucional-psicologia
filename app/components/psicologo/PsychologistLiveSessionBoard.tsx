"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  clearPsychologistRoomEntered,
  clearSharedLiveSession,
  extractConsultaIdFromLiveRef,
  formatLiveElapsed,
  getSharedLiveSession,
  liveSessionRefsSameConsulta,
  markPsychologistRoomEntered,
  setSharedLiveSession,
  subscribeSharedLiveSession,
  type SharedLiveSessionState,
} from "@/app/lib/live-session-shared";
import { normalizePsychologistSalaSelectedRef, psychologistSessionRoomPath } from "@/app/lib/psychologist-session-routes";
import {
  apiAgendaToMock,
  fetchPsychologistAgenda,
  finishPsychologistAppointment,
  joinPsychologistRoom,
  patchPsychologistAppointmentMeetingLink,
} from "@/app/lib/psychologist-agenda-api";
import { openRoomRealtimeSocket, sendRoomRealtimeEvent } from "@/app/lib/room-realtime-ws";
import { todayIso, type PsychologistAgendaAppointment } from "@/app/lib/psicologo-mocks";

/** Pode iniciar até 10 min antes do horário marcado */
const EARLY_START_MS = 10 * 60 * 1000;

type PickableSession = {
  ref: string;
  patientName: string;
  isoDate: string;
  time: string;
  durationMin: number;
  format: string;
  sourceLabel: string;
  patientOnline?: boolean;
};

function atLocalDateTime(isoDate: string, hhmm: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

function buildUpcomingSessions(today: string, agenda: PsychologistAgendaAppointment[]): PickableSession[] {
  const rows: PickableSession[] = [];

  for (const a of agenda) {
    if (a.isoDate < today) continue;
    if (a.format !== "Online") continue;
    if (a.pagamentoPendente) continue;
    if (a.status === "cancelada" || a.status === "realizada") continue;
    rows.push({
      ref: `appointment:${a.id}`,
      patientName: a.patientName?.trim() || `Paciente (agenda ${a.id})`,
      isoDate: a.isoDate,
      time: a.time,
      durationMin: a.durationMin ?? 50,
      format: a.format,
      sourceLabel: "Agenda",
      patientOnline: Boolean(a.patientOnline),
    });
  }

  return rows.sort((x, y) => {
    const d = x.isoDate.localeCompare(y.isoDate);
    if (d !== 0) return d;
    const c = x.time.localeCompare(y.time);
    if (c !== 0) return c;
    return x.patientName.localeCompare(y.patientName, "pt-BR");
  });
}

function formatAgendaDayHeading(isoDate: string): string {
  const safe = `${isoDate}T12:00:00`;
  const dt = new Date(safe);
  return dt.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Agrupa sessões já ordenadas por data/hora em blocos por `isoDate`. */
function groupSessionsByIsoDate(sessions: PickableSession[]): { isoDate: string; items: PickableSession[] }[] {
  const out: { isoDate: string; items: PickableSession[] }[] = [];
  for (const s of sessions) {
    const last = out[out.length - 1];
    if (last && last.isoDate === s.isoDate) last.items.push(s);
    else out.push({ isoDate: s.isoDate, items: [s] });
  }
  return out;
}

function findPickable(ref: string, list: PickableSession[]): PickableSession | undefined {
  return list.find((s) => s.ref === ref);
}

function findPickableByRoomRef(ref: string, list: PickableSession[]): PickableSession | undefined {
  const id = extractConsultaIdFromLiveRef(ref);
  if (id) {
    const byId = list.find((s) => extractConsultaIdFromLiveRef(s.ref) === id);
    if (byId) return byId;
  }
  return findPickable(ref, list);
}

/** Origem da consulta + id — desambigua quando o nome é genérico ou repetido. */
function describeLiveSessionRef(ref: string): string {
  if (ref.startsWith("appointment:")) {
    return `Consulta · ${ref.slice("appointment:".length)}`;
  }
  if (ref.startsWith("portal:")) {
    return `Portal paciente · ${ref.slice("portal:".length)}`;
  }
  if (ref.startsWith("agenda:")) {
    return `Agenda · ${ref.slice("agenda:".length)}`;
  }
  return ref;
}

function pickableFromShared(s: SharedLiveSessionState): PickableSession {
  return {
    ref: s.ref,
    patientName: s.patientName,
    isoDate: s.isoDate,
    time: s.time,
    durationMin: s.durationMin,
    format: s.format,
    sourceLabel: "Agenda",
    patientOnline: s.phase === "patient_waiting",
  };
}

type PsychologistLiveSessionBoardProps = {
  /** Quando definido, a tela é a sala individual (rota `/psicologo/sessao/[roomRef]`). */
  lockedRoomRef?: string | null;
};

export function PsychologistLiveSessionBoard({ lockedRoomRef = null }: PsychologistLiveSessionBoardProps) {
  const isRoomPage = Boolean(lockedRoomRef && lockedRoomRef.length > 0);
  const [agenda, setAgenda] = useState<PsychologistAgendaAppointment[]>([]);
  const [tick, setTick] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [selectedRef, setSelectedRef] = useState(() =>
    lockedRoomRef && lockedRoomRef.length > 0 ? normalizePsychologistSalaSelectedRef(lockedRoomRef) : "",
  );
  const [meetDraft, setMeetDraft] = useState("");
  const [shared, setShared] = useState<SharedLiveSessionState | null>(null);
  const patientOnlineSignal = useRef<
    Record<string, { observed: boolean; stableCount: number; announced: boolean }>
  >({});
  const roomWsRef = useRef<WebSocket | null>(null);
  const roomWsAppointmentIdRef = useRef<string>("");
  const lastAutoEndNotifyKey = useRef<string>("");
  /** Evita POST /finish duplicado quando o cronômetro local atinge a duração prevista. */
  const autoFinishClientKeyRef = useRef<string>("");
  /** Confirmação visível após publicar link — some sozinha (evita depender só do toast). */
  const meetLinkAckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [meetLinkPatientAck, setMeetLinkPatientAck] = useState<string | null>(null);

  function flashMeetLinkSentToPatient(patientLabel: string) {
    if (meetLinkAckTimerRef.current) clearTimeout(meetLinkAckTimerRef.current);
    setMeetLinkPatientAck(patientLabel);
    meetLinkAckTimerRef.current = setTimeout(() => {
      setMeetLinkPatientAck(null);
      meetLinkAckTimerRef.current = null;
    }, 3200);
  }

  useEffect(() => {
    return () => {
      if (meetLinkAckTimerRef.current) clearTimeout(meetLinkAckTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setMeetLinkPatientAck(null);
    if (meetLinkAckTimerRef.current) {
      clearTimeout(meetLinkAckTimerRef.current);
      meetLinkAckTimerRef.current = null;
    }
  }, [selectedRef]);

  const refreshSources = useCallback(async () => {
    const agendaResponse = await fetchPsychologistAgenda(todayIso());
    if (agendaResponse.ok && "appointments" in agendaResponse.data) {
      const mapped = apiAgendaToMock(agendaResponse.data).appointments;
      setAgenda(mapped);

      /** Consulta em andamento com cronômetro ativo no backend (não encerrada na API). */
      const liveFromApi = mapped.find(
        (item) =>
          item.status === "em_andamento" &&
          Boolean(item.sessionStartedAt) &&
          item.sessionPhase !== "ended",
      );

      const cur = getSharedLiveSession();
      if (cur) {
        const aid = extractConsultaIdFromLiveRef(cur.ref);
        if (aid) {
          const appt = mapped.find((a) => a.id === aid);
          if (appt) {
            if (appt.status === "realizada" || appt.sessionPhase === "ended") {
              const notifyKey = `${aid}|api-finalizada`;
              if (lastAutoEndNotifyKey.current !== notifyKey) {
                lastAutoEndNotifyKey.current = notifyKey;
                sendRoomRealtimeEvent(roomWsRef.current, { type: "session_ended" });
                clearPsychologistRoomEntered(cur.ref);
                clearSharedLiveSession();
                toast.message("Consulta concluída no sistema — sessão encerrada automaticamente.");
              }
            } else if (appt.status === "em_andamento" && appt.sessionStartedAt && cur.phase !== "ended") {
              const parsed = Date.parse(appt.sessionStartedAt);
              const startedAtMs = Number.isFinite(parsed) ? parsed : Date.now();
              const phaseFromBack: SharedLiveSessionState["phase"] =
                appt.sessionPhase === "patient_waiting" ? "patient_waiting" : "live";
              const nextMeet = appt.videoCallLink ?? cur.meetUrl;
              const nextStartedAt = phaseFromBack === "live" ? startedAtMs : cur.startedAtMs;
              const nextPatient = appt.patientName ?? cur.patientName;
              const nextDur = appt.durationMin ?? cur.durationMin ?? 50;
              const meetUnchanged =
                (cur.meetUrl?.trim() || "") === (typeof nextMeet === "string" ? nextMeet.trim() : "");
              if (
                cur.phase === phaseFromBack &&
                cur.startedAtMs === nextStartedAt &&
                meetUnchanged &&
                cur.patientName === nextPatient &&
                cur.isoDate === appt.isoDate &&
                cur.time === appt.time &&
                cur.durationMin === nextDur &&
                cur.format === appt.format
              ) {
                /* evita regravar localStorage / Broadcast a cada poll — elimina flicker na sala */
              } else {
                setSharedLiveSession({
                  ...cur,
                  phase: phaseFromBack,
                  patientName: nextPatient,
                  isoDate: appt.isoDate,
                  time: appt.time,
                  durationMin: nextDur,
                  format: appt.format,
                  meetUrl: nextMeet,
                  startedAtMs: nextStartedAt,
                  updatedAtMs: Date.now(),
                });
              }
            }
          }
        }
      }

      if (liveFromApi && !getSharedLiveSession()) {
        const parsed = liveFromApi.sessionStartedAt ? Date.parse(liveFromApi.sessionStartedAt) : NaN;
        const startedAtMs = Number.isFinite(parsed) ? parsed : Date.now();
        const phase: SharedLiveSessionState["phase"] =
          liveFromApi.sessionPhase === "patient_waiting" ? "patient_waiting" : "live";
        const next: SharedLiveSessionState = {
          version: 1,
          ref: `appointment:${liveFromApi.id}`,
          phase,
          patientName: liveFromApi.patientName,
          psychologistName: "Psicólogo",
          isoDate: liveFromApi.isoDate,
          time: liveFromApi.time,
          durationMin: liveFromApi.durationMin ?? 50,
          format: liveFromApi.format,
          meetUrl: liveFromApi.videoCallLink,
          startedAtMs: phase === "live" ? startedAtMs : undefined,
          updatedAtMs: Date.now(),
        };
        setSharedLiveSession(next);
      }

      const nextSignal: Record<string, { observed: boolean; stableCount: number; announced: boolean }> = {};
      for (const item of mapped) {
        const key = item.id;
        const isOnline = Boolean(item.patientOnline);
        const prev = patientOnlineSignal.current[key];
        if (!prev) {
          // Primeira leitura não gera alerta para evitar falso positivo ao abrir o painel.
          nextSignal[key] = { observed: isOnline, stableCount: 1, announced: isOnline };
          continue;
        }
        const observed = prev.observed === isOnline ? prev.observed : isOnline;
        const stableCount = prev.observed === isOnline ? prev.stableCount + 1 : 1;
        let announced = prev.announced;
        if (observed !== announced && stableCount >= 2) {
          if (observed) {
            toast.success(`Paciente online na sala: ${item.patientName}`);
          } else {
            toast.message(`Paciente saiu da sala: ${item.patientName}`);
          }
          announced = observed;
        }
        nextSignal[key] = { observed, stableCount, announced };
      }
      patientOnlineSignal.current = nextSignal;
    } else {
      setAgenda([]);
      const detail = "detail" in agendaResponse.data ? agendaResponse.data.detail : "";
      if (detail) toast.error(String(detail));
    }
    setShared(getSharedLiveSession());
  }, []);

  useEffect(() => {
    void refreshSources();
    setHydrated(true);
    const unsub = subscribeSharedLiveSession(() => {
      setShared(getSharedLiveSession());
    });
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    const pollId = window.setInterval(() => {
      void refreshSources();
    }, 3000);
    const onAgendaChanged = () => {
      void refreshSources();
    };
    window.addEventListener("psychologist-agenda-changed", onAgendaChanged);
    window.addEventListener("portal-billing-changed", onAgendaChanged);
    window.addEventListener("storage", onAgendaChanged);

    function onWindowFocus() {
      void refreshSources();
    }
    function onVisibilityChange() {
      if (document.visibilityState === "visible") void refreshSources();
    }
    window.addEventListener("focus", onWindowFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pageshow", onWindowFocus);

    return () => {
      unsub();
      window.clearInterval(id);
      window.clearInterval(pollId);
      window.removeEventListener("psychologist-agenda-changed", onAgendaChanged);
      window.removeEventListener("portal-billing-changed", onAgendaChanged);
      window.removeEventListener("storage", onAgendaChanged);
      window.removeEventListener("focus", onWindowFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pageshow", onWindowFocus);
    };
  }, [refreshSources]);

  useEffect(() => {
    if (lockedRoomRef && lockedRoomRef.length > 0) {
      setSelectedRef(normalizePsychologistSalaSelectedRef(lockedRoomRef));
    }
  }, [lockedRoomRef]);

  const pickableFromTodayOnward = useMemo(
    () => buildUpcomingSessions(todayIso(), agenda),
    [agenda],
  );

  const resolvedSession = useMemo((): PickableSession | null => {
    if (selectedRef) {
      const fromList = findPickableByRoomRef(selectedRef, pickableFromTodayOnward);
      if (fromList) return fromList;
    }
    const s = shared;
    if (
      s &&
      selectedRef &&
      liveSessionRefsSameConsulta(s.ref, selectedRef) &&
      (s.phase === "patient_waiting" || s.phase === "live" || s.phase === "ended")
    ) {
      return pickableFromShared(s);
    }
    return null;
  }, [selectedRef, pickableFromTodayOnward, shared]);

  useEffect(() => {
    const roomRef = lockedRoomRef && lockedRoomRef.length > 0 ? lockedRoomRef : selectedRef;
    if (!isRoomPage || !roomRef) return;
    const syncPresence = () => {
      const current = getSharedLiveSession();
      if (current?.phase === "live" || current?.phase === "ended") return;
      markPsychologistRoomEntered(roomRef);
    };
    syncPresence();
    const id = window.setInterval(syncPresence, 2500);
    return () => {
      window.clearInterval(id);
      clearPsychologistRoomEntered(roomRef);
    };
  }, [isRoomPage, lockedRoomRef, selectedRef]);

  useEffect(() => {
    if (!isRoomPage) return;
    const roomRef = lockedRoomRef && lockedRoomRef.length > 0 ? lockedRoomRef : selectedRef;
    if (!roomRef) return;
    const appointmentId = extractConsultaIdFromLiveRef(roomRef);
    if (!appointmentId) return;
    if (roomWsRef.current && roomWsAppointmentIdRef.current === appointmentId) return;
    if (roomWsRef.current) {
      roomWsRef.current.close();
      roomWsRef.current = null;
      roomWsAppointmentIdRef.current = "";
    }
    const ws = openRoomRealtimeSocket(appointmentId, () => {
      // Mantém canal em tempo real para paciente/psicólogo na mesma sala.
    });
    roomWsRef.current = ws;
    roomWsAppointmentIdRef.current = appointmentId;
    return () => {
      if (roomWsRef.current) roomWsRef.current.close();
      roomWsRef.current = null;
      roomWsAppointmentIdRef.current = "";
    };
  }, [isRoomPage, lockedRoomRef, selectedRef]);

  useEffect(() => {
    if (isRoomPage) return;
    const s = getSharedLiveSession();
    if (s && (s.phase === "patient_waiting" || s.phase === "live")) {
      setSelectedRef(normalizePsychologistSalaSelectedRef(s.ref));
    }
  }, [shared, isRoomPage]);

  useEffect(() => {
    const cur = getSharedLiveSession();
    if (cur && liveSessionRefsSameConsulta(cur.ref, selectedRef)) {
      setMeetDraft(cur.meetUrl ?? "");
      return;
    }
    const selId = extractConsultaIdFromLiveRef(selectedRef);
    const fromAgenda = selId
      ? agenda.find((item) => item.id === selId)?.videoCallLink
      : agenda.find((item) => `appointment:${item.id}` === selectedRef)?.videoCallLink;
    setMeetDraft(fromAgenda ?? "");
  }, [selectedRef, agenda]);

  useEffect(() => {
    const cur = getSharedLiveSession();
    if (!cur || !liveSessionRefsSameConsulta(cur.ref, selectedRef) || !cur.meetUrl) return;
    setMeetDraft(cur.meetUrl);
  }, [shared?.meetUrl, shared?.ref, selectedRef]);

  const scheduleWindow = useMemo(() => {
    if (!resolvedSession) return null;
    const startMs = atLocalDateTime(resolvedSession.isoDate, resolvedSession.time).getTime();
    const endMs = startMs + resolvedSession.durationMin * 60 * 1000;
    const earlyMs = startMs - EARLY_START_MS;
    return { startMs, endMs, earlyMs };
  }, [resolvedSession]);

  const timeStatus = useMemo(() => {
    if (!scheduleWindow || !resolvedSession) return null;
    const nowMs = Date.now();
    const { startMs, endMs, earlyMs } = scheduleWindow;
    if (nowMs < earlyMs) {
      const untilEarly = Math.ceil((earlyMs - nowMs) / 60000);
      return {
        tone: "neutral" as const,
        title: "Fora da janela de início",
        detail: `Início permitido até 10 min antes · faltam ~${untilEarly} min (às ${resolvedSession.time}).`,
      };
    }
    if (nowMs >= earlyMs && nowMs < startMs) {
      const untilStart = Math.ceil((startMs - nowMs) / 60000);
      return {
        tone: "soon" as const,
        title: "Quase na hora",
        detail:
          untilStart <= 1
            ? `Marcado às ${resolvedSession.time} — já pode iniciar.`
            : `Marcado às ${resolvedSession.time} · ~${untilStart} min · já pode iniciar.`,
      };
    }
    if (nowMs >= startMs && nowMs <= endMs) {
      return {
        tone: "now" as const,
        title: "Dentro do horário",
        detail: `Até ${new Date(endMs).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`,
      };
    }
    return {
      tone: "late" as const,
      title: "Após o horário da agenda",
      detail: "A janela desta consulta acabou. Não é possível iniciar fora do período previsto.",
    };
  }, [scheduleWindow, resolvedSession, tick]);

  const canStartBySchedule = useMemo(() => {
    if (!scheduleWindow || !resolvedSession) return false;
    const nowMs = Date.now();
    return nowMs >= scheduleWindow.earlyMs && nowMs <= scheduleWindow.endMs;
  }, [scheduleWindow, resolvedSession, tick]);

  /** Paciente no portal na sala — desbloqueia início independente do relógio (não exige estar na lista de “hoje”). */
  const patientWaitingSameRef =
    shared?.phase === "patient_waiting" &&
    Boolean(selectedRef) &&
    liveSessionRefsSameConsulta(shared.ref, selectedRef);

  /** Paciente na sala + link + janela do fluxo (estado compartilhado) liberou o início. */
  const patientPathStartReady = useMemo(() => {
    if (!patientWaitingSameRef || !shared) return false;
    return canStartBySchedule && Boolean(shared.meetUrl?.trim());
  }, [patientWaitingSameRef, shared, canStartBySchedule]);

  /** Início sem paciente na sala de espera — somente na janela da agenda. */
  const soloStartAllowed =
    !patientWaitingSameRef && Boolean(resolvedSession) && canStartBySchedule;

  const canStartPrep =
    Boolean(resolvedSession) &&
    shared?.phase !== "live" &&
    shared?.phase !== "ended" &&
    (soloStartAllowed || patientPathStartReady);

  function resolveMeetUrlForSession(
    cur: SharedLiveSessionState | null,
    sel: PickableSession,
  ): string | undefined {
    if (cur?.ref === sel.ref) {
      return cur.meetUrl?.trim() || undefined;
    }
    const agendaMeet = agenda.find((item) => `appointment:${item.id}` === sel.ref)?.videoCallLink;
    return agendaMeet?.trim() || undefined;
  }

  async function handleSaveMeetLink() {
    if (!selectedRef || !resolvedSession) return;
    const trimmed = meetDraft.trim();
    if (!trimmed) {
      toast.error("Informe um link válido para salvar.");
      return;
    }
    const appointmentId = extractConsultaIdFromLiveRef(resolvedSession.ref);
    if (!appointmentId) {
      toast.error("Consulta não identificada para salvar o link.");
      return;
    }
    const out = await patchPsychologistAppointmentMeetingLink(appointmentId, trimmed);
    if (!out.ok) {
      toast.error(out.detail);
      return;
    }
    const cur = getSharedLiveSession();
    if (cur?.ref === resolvedSession.ref) {
      setSharedLiveSession({
        ...cur,
        meetUrl: trimmed,
        updatedAtMs: Date.now(),
      });
    }
    sendRoomRealtimeEvent(roomWsRef.current, { type: "meeting_link_updated", meeting_link: trimmed });
    await refreshSources();
    const who = resolvedSession.patientName.trim() || "paciente";
    flashMeetLinkSentToPatient(who);
    toast.success(`Link enviado para a sala de espera de ${who}.`, { duration: 2200 });
  }

  async function handleStart() {
    if (!resolvedSession) return;
    const appointmentId = extractConsultaIdFromLiveRef(resolvedSession.ref);
    if (!appointmentId) {
      toast.error("Consulta não identificada.");
      return;
    }
    const join = await joinPsychologistRoom(appointmentId);
    if (!join.ok) {
      toast.error(join.detail);
      return;
    }
    const joinUrl = join.data.join_url?.trim() || undefined;
    const cur = getSharedLiveSession();
    const parsedStart = join.data.appointment.session_started_at
      ? Date.parse(join.data.appointment.session_started_at)
      : NaN;
    const startedAtMs = Number.isFinite(parsedStart) ? parsedStart : Date.now();
    const meetUrl = resolveMeetUrlForSession(cur, resolvedSession);
    const next: SharedLiveSessionState = {
      version: 1,
      ref: resolvedSession.ref,
      phase: "live",
      patientName: resolvedSession.patientName,
      psychologistName: cur?.psychologistName?.trim() || "Psicólogo",
      isoDate: resolvedSession.isoDate,
      time: resolvedSession.time,
      durationMin: resolvedSession.durationMin,
      format: resolvedSession.format,
      meetUrl: joinUrl || meetUrl,
      patientJoinedAtMs: cur?.ref === resolvedSession.ref ? cur.patientJoinedAtMs : undefined,
      startedAtMs,
      updatedAtMs: Date.now(),
    };
    setSharedLiveSession(next);
    sendRoomRealtimeEvent(roomWsRef.current, {
      type: "session_started",
      session_started_at: join.data.appointment.session_started_at ?? null,
    });
    await refreshSources();
    toast.success(
      patientWaitingSameRef
        ? `Sessão com ${resolvedSession.patientName} — cronômetro sincronizado com o paciente.`
        : "Sessão iniciada. O paciente verá o mesmo cronômetro ao entrar na sala.",
    );
  }

  function handleClearEnded() {
    if (shared?.ref) clearPsychologistRoomEntered(shared.ref);
    clearSharedLiveSession();
    setShared(null);
  }

  const elapsedMs = useMemo(() => {
    if (shared?.phase !== "live" || !shared.startedAtMs) return 0;
    return Math.max(0, Date.now() - shared.startedAtMs);
  }, [shared, tick]);

  const plannedMs = shared?.phase === "live" ? shared.durationMin * 60 * 1000 : 0;
  const progressPct =
    shared?.phase === "live" && plannedMs > 0 ? Math.min(100, (elapsedMs / plannedMs) * 100) : 0;
  const remainingMs =
    shared?.phase === "live" ? Math.max(0, plannedMs - elapsedMs) : 0;

  /** Ao esgotar o tempo previsto (cronômetro local), finaliza a consulta na API e limpa a sala — não depende só do poll da agenda. */
  useEffect(() => {
    const s = shared;
    if (s?.phase !== "live" || !s.startedAtMs || !s.durationMin) return;
    const planned = s.durationMin * 60 * 1000;
    if (planned <= 0) return;
    if (Date.now() - s.startedAtMs < planned) return;
    const id = extractConsultaIdFromLiveRef(s.ref);
    if (!id) return;
    const key = `${id}|${s.startedAtMs}|client`;
    if (autoFinishClientKeyRef.current === key) return;
    autoFinishClientKeyRef.current = key;
    void (async () => {
      const out = await finishPsychologistAppointment(id);
      if (!out.ok) {
        const d = (out.detail || "").toLowerCase();
        const already = d.includes("já encerr") || d.includes("ja encerr") || d.includes("novamente");
        if (!already) {
          toast.error(out.detail);
          autoFinishClientKeyRef.current = "";
          return;
        }
      }
      await refreshSources();
      const cur = getSharedLiveSession();
      if (cur?.ref) clearPsychologistRoomEntered(cur.ref);
      clearSharedLiveSession();
      setShared(null);
      sendRoomRealtimeEvent(roomWsRef.current, { type: "session_ended" });
      toast.message("Tempo previsto da sessão concluído — consulta finalizada automaticamente.");
    })();
  }, [shared, tick, refreshSources]);

  useEffect(() => {
    if (!hydrated || shared?.phase === "live" || shared?.phase === "patient_waiting") return;
    const exists = shared
      ? pickableFromTodayOnward.some((s) => liveSessionRefsSameConsulta(s.ref, shared.ref))
      : true;
    if (shared && !exists && shared.phase !== "ended") {
      clearSharedLiveSession();
      setShared(null);
      toast.message("Estado da sessão limpo — consulta saiu da lista de hoje.");
    }
  }, [hydrated, shared, pickableFromTodayOnward]);

  const showLiveUi = shared?.phase === "live";
  const showEndedPsych = shared?.phase === "ended";

  /** URL para abrir a Meet/Zoom (API ou rascunho local). */
  const openMeetHref = useMemo(() => {
    if (!selectedRef) return undefined;
    const fromShared =
      shared && liveSessionRefsSameConsulta(shared.ref, selectedRef) ? shared.meetUrl?.trim() : "";
    if (fromShared) return fromShared;
    const selId = extractConsultaIdFromLiveRef(selectedRef);
    const fromAgenda = selId
      ? agenda.find((item) => item.id === selId)?.videoCallLink?.trim()
      : agenda.find((item) => `appointment:${item.id}` === selectedRef)?.videoCallLink?.trim();
    if (fromAgenda) return fromAgenda;
    const draft = meetDraft.trim();
    return draft || undefined;
  }, [selectedRef, shared?.ref, shared?.meetUrl, meetDraft, agenda]);

  const roomGroups = useMemo(() => {
    const list = [...pickableFromTodayOnward];
    if (
      shared &&
      shared.phase === "patient_waiting" &&
      !pickableFromTodayOnward.some((s) => liveSessionRefsSameConsulta(s.ref, shared.ref))
    ) {
      const row = pickableFromShared(shared);
      list.push(row);
      list.sort((x, y) => {
        const d = x.isoDate.localeCompare(y.isoDate);
        if (d !== 0) return d;
        const t = x.time.localeCompare(y.time);
        if (t !== 0) return t;
        return x.patientName.localeCompare(y.patientName, "pt-BR");
      });
    }
    return groupSessionsByIsoDate(list);
  }, [pickableFromTodayOnward, shared]);

  const flatRoomList = useMemo(() => roomGroups.flatMap((g) => g.items), [roomGroups]);

  const selectedRoomIndex = useMemo(() => {
    const i = flatRoomList.findIndex((s) => liveSessionRefsSameConsulta(s.ref, selectedRef));
    return i >= 0 ? i + 1 : 0;
  }, [flatRoomList, selectedRef]);

  if (!hydrated) {
    return (
      <div className="rounded-2xl border border-sky-100 bg-white p-10 text-center text-sm text-slate-500">
        Carregando…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-sky-100 bg-gradient-to-r from-sky-50 to-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-800">Atendimento ao vivo</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Sessão com o paciente</h1>
        <p className="mt-2 max-w-xl text-sm text-slate-600">
          Alinhado ao portal do paciente: escolha a sala, publique o link e inicie o cronômetro quando estiver pronto. O
          encerramento da sessão e a conclusão da consulta são automáticos no sistema após a realização.
        </p>
      </section>

      {!isRoomPage && showLiveUi && shared ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-sky-200 bg-sky-50/90 px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-sky-950">Há uma sessão em andamento.</p>
          <Link
            href={psychologistSessionRoomPath(shared.ref)}
            className="inline-flex shrink-0 justify-center rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
          >
            Ver sala e cronômetro
          </Link>
        </div>
      ) : null}

      {showLiveUi && isRoomPage && shared && lockedRoomRef && !liveSessionRefsSameConsulta(shared.ref, lockedRoomRef) ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">Outra sala está com o cronômetro ativo.</p>
          <Link href={psychologistSessionRoomPath(shared.ref)} className="mt-2 inline-block font-semibold text-sky-800 underline">
            Ir para {describeLiveSessionRef(shared.ref)}
          </Link>
        </div>
      ) : null}

      {showEndedPsych && shared ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          {isRoomPage ? (
            <div className="mb-4">
              <Link
                href="/psicologo/sessao"
                className="inline-flex text-sm font-semibold text-sky-800 hover:underline"
              >
                ← Voltar às próximas consultas
              </Link>
            </div>
          ) : null}
          <p className="text-lg font-semibold text-slate-900">Sessão finalizada</p>
          <p className="mt-2 text-sm text-slate-600">
            O sistema encerrou a sessão ao concluir a consulta (registrada às{" "}
            {shared.endedAtMs
              ? new Date(shared.endedAtMs).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })
              : "—"}
            ). Só o psicólogo inicia o cronômetro; a finalização é automática.
          </p>
          {shared.startedAtMs && shared.endedAtMs ? (
            <p className="mt-2 text-sm text-slate-700">
              Duração: <strong>{formatLiveElapsed(shared.endedAtMs - shared.startedAtMs)}</strong>
            </p>
          ) : null}
          <button
            type="button"
            onClick={handleClearEnded}
            className="mt-6 rounded-full bg-sky-600 px-6 py-3 text-sm font-semibold text-white hover:bg-sky-700"
          >
            Limpar e preparar nova sessão
          </button>
        </div>
      ) : null}

      {!showLiveUi && !showEndedPsych ? (
        <>
          {!isRoomPage && flatRoomList.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <p className="text-sm text-slate-600">
                Não há consultas online futuras na agenda (a partir de{" "}
                <span className="font-semibold text-slate-800">{formatAgendaDayHeading(todayIso())}</span>) para abrir
                como sala.
              </p>
              <p className="mt-2 text-xs text-slate-500">
                As salas aparecem aqui agrupadas por data da consulta. Confira a{" "}
                <Link href="/psicologo/agenda" className="font-semibold text-sky-800 underline">
                  agenda completa
                </Link>{" "}
                ou cadastre consultas online pagas.
              </p>
            </div>
          ) : null}

          {!isRoomPage && flatRoomList.length > 0 ? (
            <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <header className="border-b border-slate-100 bg-slate-50/80 px-5 py-4 sm:px-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-800">Próximas consultas</p>
                <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
                  Salas online por data
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-slate-600">
                  Cada data da agenda lista as salas daquele dia (uma por consulta online). O card destaca quando o
                  paciente entra no portal.
                </p>
              </header>
              <div className="divide-y divide-slate-100">
                {roomGroups.map((group) => (
                  <section
                    key={group.isoDate}
                    id={`salas-dia-${group.isoDate}`}
                    className="px-5 py-6 sm:px-6"
                    aria-label={`Consultas do dia ${group.isoDate}`}
                  >
                    <div className="mb-4 flex flex-wrap items-end justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-800">Dia da agenda</p>
                        <h3 className="mt-0.5 text-base font-semibold text-slate-900 sm:text-lg">
                          {formatAgendaDayHeading(group.isoDate)}
                        </h3>
                        <p className="mt-1 font-mono text-xs text-slate-500">{group.isoDate}</p>
                      </div>
                      <p className="text-xs text-slate-500">
                        {group.items.length} sala{group.items.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div
                      className="grid min-h-0 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                      aria-label={`Salas de atendimento em ${group.isoDate}`}
                    >
                      {group.items.map((s, idx) => {
                        const patientInThis = Boolean(s.patientOnline);
                        return (
                          <Link
                            key={s.ref}
                            href={psychologistSessionRoomPath(s.ref)}
                            className={`flex min-h-[200px] flex-col rounded-2xl border-2 p-5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 ${
                              patientInThis
                                ? "border-sky-500 bg-sky-50/80 shadow-md ring-2 ring-amber-400 ring-offset-2 ring-offset-white"
                                : "border-slate-200 bg-white hover:border-sky-300 hover:bg-slate-50/90"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-sky-800">
                                Sala {idx + 1}
                              </span>
                              {patientInThis ? (
                                <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-900">
                                  Paciente entrou na sala
                                </span>
                              ) : (
                                <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                                  Disponível
                                </span>
                              )}
                            </div>
                            <p className="mt-5 text-3xl font-bold tabular-nums leading-none tracking-tight text-slate-900">
                              {s.time}
                            </p>
                            <p className="mt-3 line-clamp-2 text-sm font-semibold leading-snug text-slate-800">
                              {s.patientName}
                            </p>
                            <p className="mt-2 text-xs text-slate-500">
                              {s.format} · {s.sourceLabel}
                            </p>
                            {patientInThis ? (
                              <p className="mt-2 text-xs font-medium text-emerald-700">Paciente na fila no portal.</p>
                            ) : null}
                            <div className="mt-auto border-t border-slate-200/80 pt-4">
                              <p className="text-xs font-semibold text-sky-800">Abrir sala →</p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </article>
          ) : null}

          {isRoomPage && lockedRoomRef ? (
            <>
              <div className="mb-2">
                <Link
                  href="/psicologo/sessao"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-sky-800 hover:underline"
                >
                  ← Voltar às próximas consultas
                </Link>
              </div>
              {!resolvedSession ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                  <p className="text-sm font-medium text-slate-800">Sala não disponível</p>
                  <p className="mt-2 text-xs text-slate-600">
                    Este link não corresponde a uma consulta futura ou a uma sala ativa. Confira o endereço ou volte à lista.
                  </p>
                  <Link
                    href="/psicologo/sessao"
                    className="mt-5 inline-flex rounded-full bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-700"
                  >
                    Ver salas disponíveis
                  </Link>
                </div>
              ) : (
                <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="px-5 py-6 sm:px-6">
                  <div className="overflow-hidden rounded-2xl border-2 border-sky-200 bg-gradient-to-b from-sky-50/50 via-white to-white shadow-inner">
                    <div className="border-b border-sky-100/90 bg-sky-600/5 px-5 py-4 sm:px-6">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-800">Sessão online</p>
                          <p className="mt-1 truncate text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
                            {resolvedSession.time} · {resolvedSession.patientName}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-600">
                            {resolvedSession.format} · {resolvedSession.sourceLabel}
                            {selectedRoomIndex > 0 ? ` · Sala ${selectedRoomIndex}` : null}
                          </p>
                        </div>
                        {patientWaitingSameRef ? (
                          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-900">
                            <span aria-hidden>👤</span>
                            Paciente na sala
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="px-5 py-6 sm:px-6">
                      <ol className="space-y-8">
                        <li className="flex gap-3 sm:gap-4">
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white shadow-sm ring-2 ring-white"
                            aria-hidden
                          >
                            1
                          </span>
                          <div className="min-w-0 flex-1 space-y-2">
                            <h3 className="text-sm font-semibold text-slate-900">Link da videochamada</h3>
                            <p className="text-xs text-slate-600">
                              <span className="font-medium text-slate-700">Enviar à sala do paciente</span> grava na
                              consulta e aparece na fila de espera do portal dele na hora.{" "}
                              <span className="font-medium text-slate-700">Abrir chamada</span> abre o mesmo URL aqui
                              (para você entrar na Meet/Zoom).
                            </p>
                            <label htmlFor="meet-url-psych" className="sr-only">
                              URL da videochamada
                            </label>
                            <input
                              id="meet-url-psych"
                              type="url"
                              inputMode="url"
                              autoComplete="off"
                              placeholder="https://meet.google.com/..."
                              value={meetDraft}
                              onChange={(e) => setMeetDraft(e.target.value)}
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                            />
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={handleSaveMeetLink}
                                disabled={!selectedRef}
                                className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Enviar à sala do paciente
                              </button>
                              {openMeetHref ? (
                                <a
                                  href={openMeetHref}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
                                >
                                  Abrir chamada
                                </a>
                              ) : (
                                <span className="text-xs text-slate-500">Informe o link para habilitar.</span>
                              )}
                            </div>
                            {meetLinkPatientAck ? (
                              <div
                                role="status"
                                aria-live="polite"
                                className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-950 shadow-sm transition-opacity duration-300"
                              >
                                <p className="font-semibold">Enviado para {meetLinkPatientAck}</p>
                                <p className="mt-0.5 text-xs font-normal text-emerald-900/90">
                                  O link já está na sala de espera do paciente. Esta mensagem some em instantes.
                                </p>
                              </div>
                            ) : null}
                          </div>
                        </li>

                        <li className="flex gap-3 sm:gap-4">
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white shadow-sm ring-2 ring-white"
                            aria-hidden
                          >
                            2
                          </span>
                          <div className="min-w-0 flex-1 space-y-3">
                            <h3 className="text-sm font-semibold text-slate-900">Iniciar sessão</h3>
                            <p className="text-xs text-slate-600">
                              O cronômetro só corre depois que você iniciar, dentro da janela permitida da consulta. O
                              encerramento da sessão no sistema é automático quando a consulta for concluída.
                            </p>

                            {resolvedSession && timeStatus && !patientWaitingSameRef ? (
                              <div
                                className={`rounded-xl border px-3 py-2.5 text-sm ${
                                  timeStatus.tone === "now"
                                    ? "border-sky-200 bg-sky-50 text-sky-950"
                                    : timeStatus.tone === "soon"
                                      ? "border-amber-200 bg-amber-50 text-amber-950"
                                      : timeStatus.tone === "late"
                                        ? "border-slate-200 bg-slate-50 text-slate-800"
                                        : "border-sky-200 bg-sky-50 text-sky-950"
                                }`}
                              >
                                <p className="font-semibold">{timeStatus.title}</p>
                                <p className="mt-0.5 text-xs leading-snug opacity-90">{timeStatus.detail}</p>
                              </div>
                            ) : null}

                            {patientWaitingSameRef && shared ? (
                              <div className="rounded-xl border border-sky-200 bg-sky-50/90 px-3 py-2.5 text-sm text-sky-950">
                                {!shared.meetUrl?.trim() ? (
                                  <p className="font-medium">Salve o link (passo 1) antes de iniciar.</p>
                                ) : !canStartBySchedule ? (
                                  <p className="font-medium">Aguarde a janela da consulta (10 min antes até o fim).</p>
                                ) : (
                                  <p className="font-medium">Janela ativa: pode iniciar agora.</p>
                                )}
                              </div>
                            ) : null}

                            <button
                              type="button"
                              disabled={!canStartPrep}
                              onClick={handleStart}
                              aria-label="Iniciar cronômetro da sessão"
                              className="inline-flex w-full max-w-md items-center justify-center gap-2 rounded-full bg-sky-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-sky-900/10 transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <span className="text-base leading-none" aria-hidden>
                                ▶
                              </span>
                              Iniciar sessão
                            </button>

                            {!canStartPrep && resolvedSession ? (
                              <p className="text-xs text-slate-500">
                                {!canStartBySchedule
                                  ? "Aguarde a janela da consulta (10 min antes até o fim da duração)."
                                  : patientWaitingSameRef && !shared?.meetUrl?.trim()
                                    ? "Salve o link no passo 1."
                                    : "Confira a sala selecionada."}
                              </p>
                            ) : null}

                            {typeof window !== "undefined" &&
                            "Notification" in window &&
                            Notification.permission === "default" ? (
                              <button
                                type="button"
                                onClick={() => void Notification.requestPermission()}
                                className="text-xs font-medium text-sky-800 underline hover:text-sky-950"
                              >
                                Ativar alertas do navegador
                              </button>
                            ) : null}
                          </div>
                        </li>
                      </ol>

                      <p className="mt-6 border-t border-slate-100 pt-3 text-center text-[11px] text-slate-400">
                        Em breve: notas da sessão e materiais.
                      </p>
                    </div>
                  </div>
                  </div>
                </article>
              )}
            </>
          ) : null}
        </>
      ) : null}

      {showLiveUi && shared && isRoomPage && lockedRoomRef && liveSessionRefsSameConsulta(shared.ref, lockedRoomRef) ? (
        <div className="overflow-hidden rounded-2xl border-2 border-sky-200 bg-gradient-to-b from-white to-sky-50/40 shadow-xl">
          <div className="border-b border-sky-100 bg-sky-50/80 px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-sky-900">Em andamento</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{shared.patientName}</p>
            <p className="text-xs text-slate-600">
              {shared.time} · {shared.format} · {shared.durationMin} min
              {shared.patientJoinedAtMs ? " · paciente aguardou antes do início" : ""}
            </p>
            {shared.meetUrl ? (
              <a
                href={shared.meetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-sm font-semibold text-sky-800 underline"
              >
                Abrir videochamada
              </a>
            ) : (
              <p className="mt-2 text-xs text-amber-800">Sem link salvo — use outro canal se precisar.</p>
            )}
          </div>

          <div className="flex flex-col items-center px-6 py-10">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Tempo decorrido</p>
            <p className="mt-4 font-mono text-6xl font-bold tabular-nums tracking-tight text-sky-900 sm:text-7xl">
              {formatLiveElapsed(elapsedMs)}
            </p>
            <div className="mt-8 h-3 w-full max-w-md overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-sky-500 transition-[width] duration-1000 ease-linear"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="mt-3 text-center text-sm text-slate-600">
              {remainingMs > 0
                ? `~${Math.ceil(remainingMs / 60000)} min restantes (previsto ${shared.durationMin} min).`
                : "Tempo previsto esgotado — a sessão segue até o sistema concluir a consulta automaticamente."}
            </p>

            <div className="mt-8 w-full max-w-2xl rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-left">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">Corrigir link</p>
              <p className="mt-1 text-sm text-amber-950">
                Se o link estiver errado, atualize abaixo. O paciente recebe a alteração na hora.
              </p>
              <label htmlFor="meet-url-live-edit" className="sr-only">
                Corrigir URL da videochamada em andamento
              </label>
              <input
                id="meet-url-live-edit"
                type="url"
                inputMode="url"
                autoComplete="off"
                placeholder="https://meet.google.com/..."
                value={meetDraft}
                onChange={(e) => setMeetDraft(e.target.value)}
                className="mt-3 w-full rounded-xl border border-amber-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveMeetLink}
                  disabled={!selectedRef}
                  className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Enviar correção à sala do paciente
                </button>
                {openMeetHref ? (
                  <a
                    href={openMeetHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
                  >
                    Abrir link atual
                  </a>
                ) : null}
              </div>
              {meetLinkPatientAck ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-950 shadow-sm"
                >
                  <p className="font-semibold">Atualização enviada para {meetLinkPatientAck}</p>
                  <p className="mt-0.5 text-xs font-normal text-emerald-900/90">
                    O paciente vê o novo link na sala de espera. Esta mensagem some em instantes.
                  </p>
                </div>
              ) : null}
            </div>

            <p className="mt-8 max-w-md text-center text-xs text-slate-500">
              Não é necessário encerrar manualmente: quando a consulta for marcada como concluída no sistema, esta sala
              atualiza sozinha.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
