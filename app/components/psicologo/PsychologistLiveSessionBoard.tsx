"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  formatAppointmentDatePt,
} from "@/app/lib/portal-mocks";
import {
  clearPsychologistRoomEntered,
  clearSharedLiveSession,
  getSharedLiveSession,
  markPsychologistRoomEntered,
  setSharedLiveSession,
  subscribeSharedLiveSession,
  type SharedLiveSessionState,
} from "@/app/lib/live-session-shared";
import { psychologistSessionRoomPath } from "@/app/lib/psychologist-session-routes";
import {
  apiAgendaToMock,
  fetchPsychologistAgenda,
  finishPsychologistAppointment,
  joinPsychologistRoom,
  patchPsychologistAppointmentMeetingLink,
} from "@/app/lib/psychologist-agenda-api";
import { openRoomRealtimeSocket, sendRoomRealtimeEvent } from "@/app/lib/room-realtime-ws";
import { todayIso, type PsychologistAgendaAppointment } from "@/app/lib/psicologo-mocks";

/** Pode iniciar até 15 min antes do horário marcado */
const EARLY_START_MS = 15 * 60 * 1000;

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

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const min = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${min}:${String(sec).padStart(2, "0")}`;
}

function buildUpcomingSessions(today: string, agenda: PsychologistAgendaAppointment[]): PickableSession[] {
  const rows: PickableSession[] = [];

  for (const a of agenda) {
    if (a.isoDate < today) continue;
    if (a.format !== "Online") continue;
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

function findPickable(ref: string, list: PickableSession[]): PickableSession | undefined {
  return list.find((s) => s.ref === ref);
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

function extractAppointmentId(ref: string): string | null {
  if (ref.startsWith("appointment:")) return ref.slice("appointment:".length);
  if (ref.startsWith("agenda:")) return ref.slice("agenda:".length);
  if (ref.startsWith("portal:")) return ref.slice("portal:".length);
  return null;
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
  const [today] = useState(() => todayIso());
  const [agenda, setAgenda] = useState<PsychologistAgendaAppointment[]>([]);
  const [tick, setTick] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [selectedRef, setSelectedRef] = useState(() => (lockedRoomRef && lockedRoomRef.length > 0 ? lockedRoomRef : ""));
  const [meetDraft, setMeetDraft] = useState("");
  const [demoUnlock, setDemoUnlock] = useState(false);
  const [shared, setShared] = useState<SharedLiveSessionState | null>(null);
  const lastWaitingNotifyKey = useRef<string>("");
  const prevPatientOnline = useRef<Record<string, boolean>>({});
  const roomWsRef = useRef<WebSocket | null>(null);
  const roomWsAppointmentIdRef = useRef<string>("");

  const refreshSources = useCallback(async () => {
    const agendaResponse = await fetchPsychologistAgenda(today);
    if (agendaResponse.ok && "appointments" in agendaResponse.data) {
      const mapped = apiAgendaToMock(agendaResponse.data).appointments;
      setAgenda(mapped);
      const liveFromApi = mapped.find(
        (item) => item.status === "em_andamento" && item.sessionStartedAt,
      );
      if (liveFromApi) {
        const current = getSharedLiveSession();
        const next: SharedLiveSessionState = {
          version: 1,
          ref: `appointment:${liveFromApi.id}`,
          phase: "live",
          patientName: liveFromApi.patientName,
          psychologistName: current?.psychologistName || "Psicólogo",
          isoDate: liveFromApi.isoDate,
          time: liveFromApi.time,
          durationMin: liveFromApi.durationMin ?? 50,
          format: liveFromApi.format,
          meetUrl: liveFromApi.videoCallLink ?? current?.meetUrl,
          patientJoinedAtMs: current?.patientJoinedAtMs,
          startedAtMs: Date.parse(liveFromApi.sessionStartedAt!),
          updatedAtMs: Date.now(),
        };
        setSharedLiveSession(next);
      }
      const nowMap = Object.fromEntries(mapped.map((item) => [item.id, Boolean(item.patientOnline)]));
      for (const item of mapped) {
        const key = item.id;
        const wasOnline = prevPatientOnline.current[key] ?? false;
        const isOnline = Boolean(item.patientOnline);
        if (!wasOnline && isOnline) {
          toast.success(`Paciente online na sala: ${item.patientName}`);
        } else if (wasOnline && !isOnline) {
          toast.message(`Paciente saiu da sala: ${item.patientName}`);
        }
      }
      prevPatientOnline.current = nowMap;
    } else {
      setAgenda([]);
      const detail = "detail" in agendaResponse.data ? agendaResponse.data.detail : "";
      if (detail) toast.error(String(detail));
    }
    setShared(getSharedLiveSession());
  }, [today]);

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
      setSelectedRef(lockedRoomRef);
    }
  }, [lockedRoomRef]);

  const pickableToday = useMemo(
    () => buildUpcomingSessions(today, agenda),
    [today, agenda],
  );

  const resolvedSession = useMemo((): PickableSession | null => {
    if (selectedRef) {
      const fromList = findPickable(selectedRef, pickableToday);
      if (fromList) return fromList;
    }
    const s = shared;
    if (
      s &&
      selectedRef &&
      s.ref === selectedRef &&
      (s.phase === "patient_waiting" || s.phase === "live" || s.phase === "ended")
    ) {
      return pickableFromShared(s);
    }
    return null;
  }, [selectedRef, pickableToday, shared]);

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
    const appointmentId = extractAppointmentId(roomRef);
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
      setSelectedRef(s.ref);
    }
  }, [shared, isRoomPage]);

  useEffect(() => {
    const cur = getSharedLiveSession();
    if (cur?.ref === selectedRef) {
      setMeetDraft(cur.meetUrl ?? "");
      return;
    }
    const fromAgenda = agenda.find((item) => `appointment:${item.id}` === selectedRef)?.videoCallLink;
    setMeetDraft(fromAgenda ?? "");
  }, [selectedRef, agenda]);

  useEffect(() => {
    const cur = getSharedLiveSession();
    if (cur?.ref !== selectedRef || !cur.meetUrl) return;
    setMeetDraft(cur.meetUrl);
  }, [shared?.meetUrl, shared?.ref, selectedRef]);

  useEffect(() => {
    const s = shared;
    if (!s || s.phase !== "patient_waiting") return;
    const key = `${s.ref}|${s.patientJoinedAtMs ?? 0}`;
    if (lastWaitingNotifyKey.current === key) return;
    lastWaitingNotifyKey.current = key;
    toast.success(`Sala de espera: ${s.patientName}`, {
      duration: 10_000,
      description: `${describeLiveSessionRef(s.ref)}. Você pode iniciar quando quiser — não depende do horário marcado na agenda.`,
    });
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      try {
        new Notification("Sala de espera com paciente", {
          body: `${s.patientName} — ${describeLiveSessionRef(s.ref)}. Pode iniciar pelo painel quando quiser.`,
          tag: "clinica-patient-waiting",
        });
      } catch {
        /* ignore */
      }
    }
  }, [shared]);

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
        title: "Aguardando horário",
        detail: `Você poderá iniciar em até ${untilEarly} min (15 min antes das ${resolvedSession.time}).`,
      };
    }
    if (nowMs >= earlyMs && nowMs < startMs) {
      const untilStart = Math.ceil((startMs - nowMs) / 60000);
      return {
        tone: "soon" as const,
        title: "Quase na hora",
        detail:
          untilStart <= 1
            ? `Horário marcado: ${resolvedSession.time}. Você já pode iniciar a sessão.`
            : `Faltam cerca de ${untilStart} min para ${resolvedSession.time}. Você já pode iniciar.`,
      };
    }
    if (nowMs >= startMs && nowMs <= endMs) {
      return {
        tone: "now" as const,
        title: "É hora da sessão",
        detail: `Janela ativa até ${new Date(endMs).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`,
      };
    }
    return {
      tone: "late" as const,
      title: "Horário previsto encerrado",
      detail:
        "Com o paciente na sala de espera, você ainda pode iniciar a qualquer momento. Ou use o modo demonstração se não houver paciente.",
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
    shared.ref === selectedRef;

  /** Paciente na sala + link + janela do fluxo (estado compartilhado) liberou o início. */
  const patientPathStartReady = useMemo(() => {
    if (!patientWaitingSameRef || !shared) return false;
    return Boolean(shared.meetUrl?.trim());
  }, [patientWaitingSameRef, shared]);

  /** Início sem paciente na sala de espera (agenda ou modo demonstração). */
  const soloStartAllowed =
    !patientWaitingSameRef && Boolean(resolvedSession) && (canStartBySchedule || demoUnlock);

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
    const appointmentId = extractAppointmentId(resolvedSession.ref);
    if (!appointmentId) {
      toast.error("Não foi possível identificar a consulta para salvar o link.");
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
    toast.success("Link salvo — publicado para o paciente na sala de espera.");
  }

  async function handleStart() {
    if (!resolvedSession) return;
    const appointmentId = extractAppointmentId(resolvedSession.ref);
    if (!appointmentId) {
      toast.error("Não foi possível identificar a consulta para iniciar a sala.");
      return;
    }
    const join = await joinPsychologistRoom(appointmentId);
    if (!join.ok) {
      toast.error(join.detail);
      return;
    }
    const joinUrl = join.data.join_url?.trim() || undefined;
    const cur = getSharedLiveSession();
    const startedAtMs = join.data.appointment.session_started_at
      ? Date.parse(join.data.appointment.session_started_at)
      : Date.now();
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
    sendRoomRealtimeEvent(roomWsRef.current, { type: "session_started" });
    await refreshSources();
    toast.success(
      patientWaitingSameRef
        ? `Sessão com ${resolvedSession.patientName} iniciada — o paciente vê o cronômetro ao vivo.`
        : `Sessão iniciada (demonstração). Quando o paciente entrar na sala, ele acompanha o mesmo tempo.`,
    );
  }

  async function handleEnd() {
    const cur = getSharedLiveSession();
    if (!cur || cur.phase !== "live") return;
    const appointmentId = extractAppointmentId(cur.ref);
    if (appointmentId) {
      const finish = await finishPsychologistAppointment(appointmentId);
      if (!finish.ok) {
        toast.error(finish.detail);
        return;
      }
    }

    setSharedLiveSession({
      ...cur,
      phase: "ended",
      endedAtMs: Date.now(),
      updatedAtMs: Date.now(),
    });
    sendRoomRealtimeEvent(roomWsRef.current, { type: "session_ended" });
    clearPsychologistRoomEntered(cur.ref);
    await refreshSources();
    toast.message("Sessão encerrada. Consulta marcada como concluída e o paciente vê o encerramento.");
  }

  function handleClearEnded() {
    if (shared?.ref) clearPsychologistRoomEntered(shared.ref);
    clearSharedLiveSession();
    setShared(null);
  }

  const elapsedMs = useMemo(() => {
    if (shared?.phase !== "live" || !shared.startedAtMs) return 0;
    return Date.now() - shared.startedAtMs;
  }, [shared, tick]);

  const plannedMs = shared?.phase === "live" ? shared.durationMin * 60 * 1000 : 0;
  const progressPct =
    shared?.phase === "live" && plannedMs > 0 ? Math.min(100, (elapsedMs / plannedMs) * 100) : 0;
  const remainingMs =
    shared?.phase === "live" ? Math.max(0, plannedMs - elapsedMs) : 0;

  useEffect(() => {
    if (!hydrated || shared?.phase === "live" || shared?.phase === "patient_waiting") return;
    const exists = shared ? pickableToday.some((s) => s.ref === shared.ref) : true;
    if (shared && !exists && shared.phase !== "ended") {
      clearSharedLiveSession();
      setShared(null);
      toast.message("Estado da sessão limpo — consulta não está mais na lista de próximas consultas.");
    }
  }, [hydrated, shared, pickableToday]);

  const showLiveUi = shared?.phase === "live";
  const showEndedPsych = shared?.phase === "ended";

  const waitingSinceLabel = useMemo(() => {
    const j = shared?.patientJoinedAtMs ?? shared?.updatedAtMs;
    if (!j) return "agora há pouco";
    const sec = Math.floor((Date.now() - j) / 1000);
    if (sec < 10) return "agora há pouco";
    if (sec < 60) return `há ${sec}s`;
    const min = Math.floor(sec / 60);
    return min === 1 ? "há 1 min" : `há ${min} min`;
  }, [shared?.patientJoinedAtMs, shared?.updatedAtMs, tick]);

  /** URL para abrir a Meet/Zoom (API ou rascunho local). */
  const openMeetHref = useMemo(() => {
    if (!selectedRef) return undefined;
    const fromShared = shared?.ref === selectedRef ? shared.meetUrl?.trim() : "";
    if (fromShared) return fromShared;
    const fromAgenda = agenda.find((item) => `appointment:${item.id}` === selectedRef)?.videoCallLink?.trim();
    if (fromAgenda) return fromAgenda;
    const draft = meetDraft.trim();
    return draft || undefined;
  }, [selectedRef, shared?.ref, shared?.meetUrl, meetDraft, agenda]);

  const showPatientInWaitingBanner =
    Boolean(shared?.phase === "patient_waiting") && !showLiveUi && !showEndedPsych;

  const waitingRoomIsOpen = shared?.phase === "patient_waiting";

  const roomCards = useMemo((): PickableSession[] => {
    const refs = new Set(pickableToday.map((x) => x.ref));
    if (shared && shared.phase === "patient_waiting" && !refs.has(shared.ref)) {
      return [...pickableToday, pickableFromShared(shared)];
    }
    return pickableToday;
  }, [pickableToday, shared]);

  const selectedRoomIndex = useMemo(() => {
    const i = roomCards.findIndex((s) => s.ref === selectedRef);
    return i >= 0 ? i + 1 : 0;
  }, [roomCards, selectedRef]);

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
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          Mesmo padrão visual de <strong className="font-semibold text-slate-800">Atendimento online</strong> no portal do paciente:
          salas do dia, link na sala de espera, paciente acompanhando e <strong className="font-semibold text-slate-800">play</strong>{" "}
          para o cronômetro oficial.
        </p>
      </section>

      <p className="rounded-xl border border-sky-200 bg-sky-50/95 px-3 py-2 text-center text-[11px] leading-snug text-sky-950">
        <span className="font-semibold">Demonstração:</span> use o mesmo endereço no navegador do paciente (ex.: só{" "}
        <code className="rounded bg-white px-1 ring-1 ring-sky-200">localhost:3000</code>, sem misturar com 127.0.0.1).
      </p>

      {!isRoomPage && showLiveUi && shared ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-sky-200 bg-sky-50/90 px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-sky-950">Há uma sessão em andamento neste navegador.</p>
          <Link
            href={psychologistSessionRoomPath(shared.ref)}
            className="inline-flex shrink-0 justify-center rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
          >
            Ver sala e cronômetro
          </Link>
        </div>
      ) : null}

      {showLiveUi && isRoomPage && shared && lockedRoomRef && shared.ref !== lockedRoomRef ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">Outra sala está com o cronômetro ativo.</p>
          <Link href={psychologistSessionRoomPath(shared.ref)} className="mt-2 inline-block font-semibold text-sky-800 underline">
            Ir para {describeLiveSessionRef(shared.ref)}
          </Link>
        </div>
      ) : null}

      {showPatientInWaitingBanner && shared ? (
        <div
          className="relative overflow-hidden rounded-2xl border-2 border-sky-300 bg-gradient-to-r from-sky-600 to-indigo-700 p-4 text-white shadow-lg shadow-sky-900/20 sm:p-5"
          role="status"
          aria-live="polite"
        >
          <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20 ring-2 ring-white/40">
                <span className="absolute inline-flex h-9 w-9 animate-ping rounded-full bg-white/30 opacity-60" aria-hidden />
                <span className="relative text-xl" aria-hidden>
                  👤
                </span>
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-100">Paciente na sala de espera</p>
                <p className="mt-0.5 truncate text-lg font-bold tracking-tight">{shared.patientName}</p>
                <p className="mt-0.5 text-xs text-sky-100/95">{describeLiveSessionRef(shared.ref)}</p>
                <p className="mt-1 text-sm text-sky-50">
                  {waitingSinceLabel} · {formatAppointmentDatePt(shared.isoDate)} · {shared.time} · {shared.format}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {!patientWaitingSameRef ? (
                <Link
                  href={psychologistSessionRoomPath(shared.ref)}
                  className="rounded-full bg-white px-4 py-2 text-sm font-bold text-sky-900 shadow-md hover:bg-sky-50"
                >
                  Abrir painel da sala
                </Link>
              ) : isRoomPage && lockedRoomRef === shared.ref ? (
                <span className="rounded-full bg-white/25 px-3 py-1.5 text-xs font-semibold ring-1 ring-white/40">
                  Você está nesta sala — envie o link e inicie abaixo
                </span>
              ) : (
                <Link
                  href={psychologistSessionRoomPath(shared.ref)}
                  className="rounded-full bg-white px-4 py-2 text-sm font-bold text-sky-900 shadow-md hover:bg-sky-50"
                >
                  Ir para o painel desta sala
                </Link>
              )}
            </div>
          </div>
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
            Encerrada às{" "}
            {shared.endedAtMs
              ? new Date(shared.endedAtMs).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })
              : "—"}
            . O paciente foi notificado nesta demonstração.
          </p>
          {shared.startedAtMs && shared.endedAtMs ? (
            <p className="mt-2 text-sm text-slate-700">
              Duração: <strong>{formatElapsed(shared.endedAtMs - shared.startedAtMs)}</strong>
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
          {!isRoomPage && pickableToday.length === 0 && shared?.phase !== "patient_waiting" ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <p className="text-sm text-slate-600">Não há consultas online futuras disponíveis a partir de {today}.</p>
              <p className="mt-2 text-xs text-slate-500">
                Consulte a{" "}
                <Link href="/psicologo/agenda" className="font-semibold text-sky-800 underline">
                  agenda
                </Link>
                .
              </p>
            </div>
          ) : null}

          {!isRoomPage && (pickableToday.length > 0 || shared?.phase === "patient_waiting") ? (
            <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <header className="border-b border-slate-100 bg-slate-50/80 px-5 py-4 sm:px-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-800">Próximas consultas</p>
                <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">Escolha uma sala</h2>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
                  Cada card representa um horário futuro vindo da API — mesmo padrão de cards de{" "}
                  <strong className="font-semibold text-slate-800">/portal/atendimento</strong>. Quando o paciente entrar no portal, o
                  card destaca a fila.
                </p>
              </header>
              <div className="px-5 py-6 sm:px-6">
                <div className="mt-1 grid min-h-0 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Salas de atendimento disponíveis">
                  {roomCards.map((s, idx) => {
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
                          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-sky-800">Sala {idx + 1}</span>
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
                        <p className="mt-5 text-3xl font-bold tabular-nums leading-none tracking-tight text-slate-900">{s.time}</p>
                        <p className="mt-3 line-clamp-2 text-sm font-semibold leading-snug text-slate-800">{s.patientName}</p>
                        <p className="mt-2 text-xs text-slate-500">
                          {s.format} · {s.sourceLabel}
                        </p>
                        {patientInThis ? (
                          <p className="mt-2 text-xs font-medium text-emerald-700">
                            Paciente online no portal aguardando atendimento.
                          </p>
                        ) : null}
                        <div className="mt-auto border-t border-slate-200/80 pt-4">
                          <p className="text-xs font-semibold text-sky-800">Abrir painel desta sala →</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
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
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-sky-800">Nesta sala</p>
                      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                        <div>
                          <p className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                            Sala {selectedRoomIndex} · {resolvedSession.time}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-800">{resolvedSession.patientName}</p>
                          <p className="mt-0.5 text-xs text-slate-600">
                            {resolvedSession.format} · {resolvedSession.sourceLabel}
                          </p>
                        </div>
                        {patientWaitingSameRef ? (
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-950">
                            Paciente na fila
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                            Aguardando paciente
                          </span>
                        )}
                      </div>
                      <p className="mt-3 text-xs leading-relaxed text-slate-600">
                        Envie o link, acompanhe o paciente no portal e inicie o cronômetro — nesta ordem, nesta sala.
                      </p>
                    </div>

                    <div className="px-5 py-6 sm:px-6">
                      <ol className="space-y-10">
                        <li className="flex gap-4">
                          <span
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white shadow-sm ring-4 ring-white"
                            aria-hidden
                          >
                            1
                          </span>
                          <div className="min-w-0 flex-1 space-y-3">
                            <h3 className="text-base font-semibold text-slate-900">Enviar o link da videochamada</h3>
                            <p className="text-sm leading-relaxed text-slate-600">
                              Cole o convite da Meet ou Zoom. <strong className="font-medium text-slate-800">Salvar</strong> publica
                              na sala de espera do paciente. <strong className="font-medium text-slate-800">Abrir sala</strong> abre a
                              mesma chamada para você.
                            </p>
                            <label htmlFor="meet-url-psych" className="sr-only">
                              Link da videochamada
                            </label>
                            <input
                              id="meet-url-psych"
                              type="url"
                              inputMode="url"
                              autoComplete="off"
                              placeholder="https://meet.google.com/..."
                              value={meetDraft}
                              onChange={(e) => setMeetDraft(e.target.value)}
                              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                            />
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={handleSaveMeetLink}
                                disabled={!selectedRef}
                                className="rounded-full bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Salvar link (paciente vê)
                              </button>
                              {openMeetHref ? (
                                <a
                                  href={openMeetHref}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
                                >
                                  Abrir sala na nova aba
                                </a>
                              ) : (
                                <span className="text-xs text-slate-500">Preencha o link para abrir a videochamada.</span>
                              )}
                            </div>
                          </div>
                        </li>

                        <li className="flex gap-4">
                          <span
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-800 ring-4 ring-white"
                            aria-hidden
                          >
                            2
                          </span>
                          <div className="min-w-0 flex-1 space-y-3">
                            <h3 className="text-base font-semibold text-slate-900">Paciente no portal</h3>
                            <p className="text-sm leading-relaxed text-slate-600">
                              Com o link salvo, o paciente entra na fila neste dispositivo/navegador (demo). O status aparece aqui e
                              nos cards da lista de salas.
                            </p>
                            <div className="rounded-xl border border-slate-200 bg-slate-50/90 px-4 py-3 text-sm">
                              {waitingRoomIsOpen && shared ? (
                                <p className="text-slate-800">
                                  <span className="inline-flex items-center gap-1.5 font-semibold text-sky-800">
                                    <span className="h-2 w-2 animate-pulse rounded-full bg-sky-500" aria-hidden />
                                    Alguém na sala de espera
                                  </span>
                                  {" — "}
                                  <strong>{shared.patientName}</strong> ({describeLiveSessionRef(shared.ref)}).
                                  {!patientWaitingSameRef ? (
                                    <span className="block pt-2 text-xs text-slate-600">
                                      Este painel precisa ser o da mesma consulta em que o paciente entrou (confira o aviso verde no
                                      topo, se aparecer).
                                    </span>
                                  ) : null}
                                </p>
                              ) : (
                                <p className="text-slate-600">
                                  Ninguém na fila neste navegador ainda. Peça ao paciente para usar o mesmo endereço do site (ex. só
                                  localhost:3000).
                                </p>
                              )}
                            </div>
                          </div>
                        </li>

                        <li className="flex gap-4">
                          <span
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white shadow-sm ring-4 ring-white"
                            aria-hidden
                          >
                            3
                          </span>
                          <div className="min-w-0 flex-1 space-y-4">
                            <h3 className="text-base font-semibold text-slate-900">Iniciar atendimento (cronômetro)</h3>
                            <p className="text-sm leading-relaxed text-slate-600">
                              O tempo oficial só começa aqui. Com paciente na fila e link salvos, você pode iniciar quando quiser.
                            </p>

                            {resolvedSession && timeStatus && !patientWaitingSameRef ? (
                              <div
                                className={`rounded-xl border px-4 py-3 text-sm ${
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
                                <p className="mt-1 text-xs leading-relaxed opacity-90">{timeStatus.detail}</p>
                              </div>
                            ) : null}

                            {patientWaitingSameRef && shared ? (
                              <div className="rounded-xl border border-sky-200 bg-sky-50/90 px-4 py-3 text-sm text-sky-950">
                                {!shared.meetUrl?.trim() ? (
                                  <p className="font-medium">Salve o link no passo 1 para o paciente entrar na mesma sala.</p>
                                ) : (
                                  <p className="font-medium">Pode iniciar o cronômetro quando quiser.</p>
                                )}
                              </div>
                            ) : null}

                            <label className="flex max-w-md cursor-pointer items-center gap-2 text-sm text-slate-700">
                              <input
                                type="checkbox"
                                checked={demoUnlock}
                                onChange={(e) => setDemoUnlock(e.target.checked)}
                                className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                              />
                              Sem paciente na fila: permitir iniciar fora do horário da agenda (demo)
                            </label>

                            <button
                              type="button"
                              disabled={!canStartPrep}
                              onClick={handleStart}
                              aria-label="Iniciar cronômetro da sessão"
                              className="inline-flex w-full max-w-md items-center justify-center gap-2 rounded-full bg-sky-600 px-6 py-4 text-sm font-semibold text-white shadow-lg shadow-sky-900/15 transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <span className="text-lg leading-none" aria-hidden>
                                ▶
                              </span>
                              Iniciar cronômetro (play)
                            </button>

                            {!canStartPrep && resolvedSession ? (
                              <p className="text-xs text-slate-500">
                                {!patientWaitingSameRef && !canStartBySchedule && !demoUnlock
                                  ? "Marque a opção de demonstração, aguarde a janela de horário ou espere o paciente na fila com link salvo."
                                  : patientWaitingSameRef && !shared?.meetUrl?.trim()
                                    ? "Salve o link no passo 1."
                                    : "Verifique a sala selecionada."}
                              </p>
                            ) : null}

                            {!canStartBySchedule && resolvedSession && !demoUnlock && !patientWaitingSameRef ? (
                              <p className="text-xs text-slate-500">
                                Com paciente na fila e a mesma sala selecionada, o horário da agenda não bloqueia o início.
                              </p>
                            ) : null}

                            {typeof window !== "undefined" &&
                            "Notification" in window &&
                            Notification.permission === "default" ? (
                              <button
                                type="button"
                                onClick={() => void Notification.requestPermission()}
                                className="text-xs font-semibold text-sky-800 underline hover:text-sky-950"
                              >
                                Pedir permissão para alertas do navegador
                              </button>
                            ) : null}
                          </div>
                        </li>
                      </ol>

                      <div className="mt-10 rounded-xl border border-dashed border-slate-300 bg-slate-50/90 px-4 py-4 sm:px-5">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Próximas atividades (layout)</p>
                        <p className="mt-1 text-sm font-semibold text-slate-800">Outras ações após o atendimento</p>
                        <p className="mt-2 text-xs leading-relaxed text-slate-600">
                          Espaço reservado para evolução: notas da sessão, materiais para o paciente, tarefas de acompanhamento e
                          integração com prontuário — mantendo o mesmo fluxo sala → link → portal → play.
                        </p>
                      </div>
                    </div>
                  </div>
                  </div>
                </article>
              )}
            </>
          ) : null}
        </>
      ) : null}

      {showLiveUi && shared && isRoomPage && lockedRoomRef && shared.ref === lockedRoomRef ? (
        <div className="overflow-hidden rounded-2xl border-2 border-sky-200 bg-gradient-to-b from-white to-sky-50/40 shadow-xl">
          <div className="border-b border-sky-100 bg-sky-50/80 px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-sky-900">Em andamento · sincronizado</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{shared.patientName}</p>
            <p className="text-xs text-slate-600">
              Previsto: {shared.time} · {shared.format} · {shared.durationMin} min
              {shared.patientJoinedAtMs ? " · Paciente na sala antes do início" : ""}
            </p>
            {shared.meetUrl ? (
              <a
                href={shared.meetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-sm font-semibold text-sky-800 underline"
              >
                Abrir sala de videochamada
              </a>
            ) : (
              <p className="mt-2 text-xs text-amber-800">
                Nenhum link salvo — você ainda pode atender por outro meio.
              </p>
            )}
          </div>

          <div className="flex flex-col items-center px-6 py-10">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Tempo decorrido</p>
            <p className="mt-4 font-mono text-6xl font-bold tabular-nums tracking-tight text-sky-900 sm:text-7xl">
              {formatElapsed(elapsedMs)}
            </p>
            <div className="mt-8 h-3 w-full max-w-md overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-sky-500 transition-[width] duration-1000 ease-linear"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="mt-3 text-center text-sm text-slate-600">
              {remainingMs > 0
                ? `Aproximadamente ${Math.ceil(remainingMs / 60000)} min restantes do tempo previsto (${shared.durationMin} min).`
                : "Tempo previsto ultrapassado — encerre quando finalizar o atendimento."}
            </p>

            <button
              type="button"
              onClick={handleEnd}
              className="mt-10 rounded-full border border-slate-300 bg-white px-8 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
            >
              Encerrar sessão
            </button>
          </div>
        </div>
      ) : null}

      <p className="text-center text-xs text-slate-500">
        Estado sincronizado entre abas neste navegador.{" "}
        <Link href="/psicologo/agenda" className="font-medium text-sky-800 underline">
          Ver agenda
        </Link>
        {" · "}
        <Link href="/portal/atendimento" className="font-medium text-sky-800 underline">
          Atendimento no portal do paciente
        </Link>
      </p>
    </div>
  );
}
