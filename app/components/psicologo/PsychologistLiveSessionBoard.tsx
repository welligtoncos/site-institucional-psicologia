"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  MOCK_PSYCHOLOGIST,
  formatAppointmentDatePt,
  type MockAppointment,
} from "@/app/lib/portal-mocks";
import {
  clearPendingMeetUrl,
  clearSharedLiveSession,
  getPendingMeetUrl,
  getSharedLiveSession,
  patchSharedLiveSessionMeetUrl,
  setPendingMeetUrl,
  setSharedLiveSession,
  subscribeSharedLiveSession,
  type SharedLiveSessionState,
} from "@/app/lib/live-session-shared";
import {
  getPatientAppointments,
  markAppointmentCompletedAfterLiveSession,
} from "@/app/lib/portal-payment-mock";
import { psychologistSessionRoomPath } from "@/app/lib/psychologist-session-routes";
import {
  loadAgendaAppointments,
  markAgendaSessionCompleted,
  todayIso,
  type PsychologistAgendaAppointment,
} from "@/app/lib/psicologo-mocks";

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

function buildTodaySessions(
  today: string,
  agenda: PsychologistAgendaAppointment[],
  portal: MockAppointment[],
): PickableSession[] {
  const rows: PickableSession[] = [];
  const psychId = MOCK_PSYCHOLOGIST.id;

  for (const a of agenda) {
    if (a.isoDate !== today || a.status === "cancelada") continue;
    rows.push({
      ref: `agenda:${a.id}`,
      patientName: a.patientName?.trim() || `Paciente (agenda ${a.id})`,
      isoDate: a.isoDate,
      time: a.time,
      durationMin: MOCK_PSYCHOLOGIST.durationMin,
      format: a.format,
      sourceLabel: "Agenda",
    });
  }

  for (const p of portal) {
    if (p.psychId !== psychId || p.isoDate !== today || p.status === "cancelada") continue;
    rows.push({
      ref: `portal:${p.id}`,
      patientName: p.patientName?.trim() || `Paciente (consulta ${p.id})`,
      isoDate: p.isoDate,
      time: p.time,
      durationMin: p.durationMin,
      format: p.format,
      sourceLabel: "Portal paciente",
    });
  }

  return rows.sort((x, y) => {
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
    sourceLabel: s.ref.startsWith("portal:") ? "Portal paciente" : "Agenda",
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
  const [portalAppts, setPortalAppts] = useState<MockAppointment[]>([]);
  const [tick, setTick] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [selectedRef, setSelectedRef] = useState(() => (lockedRoomRef && lockedRoomRef.length > 0 ? lockedRoomRef : ""));
  const [meetDraft, setMeetDraft] = useState("");
  const [demoUnlock, setDemoUnlock] = useState(false);
  const [shared, setShared] = useState<SharedLiveSessionState | null>(null);
  const lastWaitingNotifyKey = useRef<string>("");

  const refreshSources = useCallback(() => {
    setAgenda(loadAgendaAppointments());
    setPortalAppts(getPatientAppointments());
    setShared(getSharedLiveSession());
  }, []);

  useEffect(() => {
    refreshSources();
    setHydrated(true);
    const unsub = subscribeSharedLiveSession(refreshSources);
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    window.addEventListener("psychologist-agenda-changed", refreshSources);
    window.addEventListener("portal-billing-changed", refreshSources);
    window.addEventListener("storage", refreshSources);

    function onWindowFocus() {
      refreshSources();
    }
    function onVisibilityChange() {
      if (document.visibilityState === "visible") refreshSources();
    }
    window.addEventListener("focus", onWindowFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pageshow", onWindowFocus);

    return () => {
      unsub();
      window.clearInterval(id);
      window.removeEventListener("psychologist-agenda-changed", refreshSources);
      window.removeEventListener("portal-billing-changed", refreshSources);
      window.removeEventListener("storage", refreshSources);
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
    () => buildTodaySessions(today, agenda, portalAppts),
    [today, agenda, portalAppts],
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
    if (isRoomPage) return;
    const s = getSharedLiveSession();
    if (s && (s.phase === "patient_waiting" || s.phase === "live")) {
      setSelectedRef(s.ref);
    }
  }, [shared, isRoomPage]);

  useEffect(() => {
    const cur = getSharedLiveSession();
    if (cur?.ref === selectedRef) {
      setMeetDraft(cur.meetUrl ?? getPendingMeetUrl(selectedRef) ?? "");
      return;
    }
    setMeetDraft(getPendingMeetUrl(selectedRef) ?? "");
  }, [selectedRef]);

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
      const u = cur.meetUrl ?? getPendingMeetUrl(sel.ref);
      return u?.trim() || undefined;
    }
    return getPendingMeetUrl(sel.ref)?.trim() || undefined;
  }

  function handleSaveMeetLink() {
    if (!selectedRef) return;
    const trimmed = meetDraft.trim();
    setPendingMeetUrl(selectedRef, trimmed);
    patchSharedLiveSessionMeetUrl(selectedRef, trimmed);
    toast.success(
      trimmed ? "Link salvo — o paciente vê na sala de espera." : "Link removido.",
    );
  }

  function handleStart() {
    if (!resolvedSession) return;
    const cur = getSharedLiveSession();
    const startedAtMs = Date.now();
    const meetUrl = resolveMeetUrlForSession(cur, resolvedSession);
    const next: SharedLiveSessionState = {
      version: 1,
      ref: resolvedSession.ref,
      phase: "live",
      patientName: resolvedSession.patientName,
      psychologistName: MOCK_PSYCHOLOGIST.name,
      isoDate: resolvedSession.isoDate,
      time: resolvedSession.time,
      durationMin: resolvedSession.durationMin,
      format: resolvedSession.format,
      meetUrl,
      patientJoinedAtMs: cur?.ref === resolvedSession.ref ? cur.patientJoinedAtMs : undefined,
      startedAtMs,
      updatedAtMs: Date.now(),
    };
    setSharedLiveSession(next);
    toast.success(
      patientWaitingSameRef
        ? `Sessão com ${resolvedSession.patientName} iniciada — o paciente vê o cronômetro ao vivo.`
        : `Sessão iniciada (demonstração). Quando o paciente entrar na sala, ele acompanha o mesmo tempo.`,
    );
  }

  function handleEnd() {
    const cur = getSharedLiveSession();
    if (!cur || cur.phase !== "live") return;

    if (cur.ref.startsWith("portal:")) {
      const id = cur.ref.slice("portal:".length);
      markAppointmentCompletedAfterLiveSession(id);
    } else if (cur.ref.startsWith("agenda:")) {
      const id = cur.ref.slice("agenda:".length);
      markAgendaSessionCompleted(id);
    }

    clearPendingMeetUrl(cur.ref);

    setSharedLiveSession({
      ...cur,
      phase: "ended",
      endedAtMs: Date.now(),
      updatedAtMs: Date.now(),
    });
    toast.message("Sessão encerrada. Consulta marcada como concluída e o paciente vê o encerramento.");
  }

  function handleClearEnded() {
    const ref = shared?.ref;
    clearSharedLiveSession();
    if (ref) clearPendingMeetUrl(ref);
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
      toast.message("Estado da sessão limpo — consulta não está mais na lista de hoje.");
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

  /** URL para abrir a Meet/Zoom (salva, pendente ou rascunho). */
  const openMeetHref = useMemo(() => {
    if (!selectedRef) return undefined;
    const fromShared = shared?.ref === selectedRef ? shared.meetUrl?.trim() : "";
    if (fromShared) return fromShared;
    const pending = getPendingMeetUrl(selectedRef)?.trim();
    if (pending) return pending;
    const draft = meetDraft.trim();
    return draft || undefined;
  }, [selectedRef, shared?.ref, shared?.meetUrl, meetDraft]);

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
      <div className="rounded-2xl border border-emerald-100 bg-white p-10 text-center text-sm text-slate-500">
        Carregando…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-center text-[11px] leading-snug text-amber-950">
        <span className="font-semibold">Demonstração:</span> use o mesmo endereço no navegador do paciente (ex.: só{" "}
        <code className="rounded bg-amber-100/80 px-1">localhost:3000</code>, sem misturar com 127.0.0.1).
      </p>

      {!isRoomPage && showLiveUi && shared ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-emerald-300 bg-emerald-50/90 px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-emerald-950">Há uma sessão em andamento neste navegador.</p>
          <Link
            href={psychologistSessionRoomPath(shared.ref)}
            className="inline-flex shrink-0 justify-center rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Ver sala e cronômetro
          </Link>
        </div>
      ) : null}

      {showLiveUi && isRoomPage && shared && lockedRoomRef && shared.ref !== lockedRoomRef ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">Outra sala está com o cronômetro ativo.</p>
          <Link href={psychologistSessionRoomPath(shared.ref)} className="mt-2 inline-block font-semibold text-emerald-800 underline">
            Ir para {describeLiveSessionRef(shared.ref)}
          </Link>
        </div>
      ) : null}

      {showPatientInWaitingBanner && shared ? (
        <div
          className="relative overflow-hidden rounded-2xl border-2 border-emerald-400 bg-gradient-to-r from-emerald-600 to-teal-700 p-4 text-white shadow-lg shadow-emerald-900/20 sm:p-5"
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
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-100">Paciente na sala de espera</p>
                <p className="mt-0.5 truncate text-lg font-bold tracking-tight">{shared.patientName}</p>
                <p className="mt-0.5 text-xs text-emerald-100/95">{describeLiveSessionRef(shared.ref)}</p>
                <p className="mt-1 text-sm text-emerald-50">
                  {waitingSinceLabel} · {formatAppointmentDatePt(shared.isoDate)} · {shared.time} · {shared.format}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {!patientWaitingSameRef ? (
                <Link
                  href={psychologistSessionRoomPath(shared.ref)}
                  className="rounded-full bg-white px-4 py-2 text-sm font-bold text-emerald-900 shadow-md hover:bg-emerald-50"
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
                  className="rounded-full bg-white px-4 py-2 text-sm font-bold text-emerald-900 shadow-md hover:bg-emerald-50"
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
                className="inline-flex text-sm font-semibold text-emerald-800 hover:underline"
              >
                ← Voltar às salas de hoje
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
            className="mt-6 rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Limpar e preparar nova sessão
          </button>
        </div>
      ) : null}

      {!showLiveUi && !showEndedPsych ? (
        <>
          {!isRoomPage && pickableToday.length === 0 && shared?.phase !== "patient_waiting" ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <p className="text-sm text-slate-600">Não há consultas mockadas para hoje ({today}).</p>
              <p className="mt-2 text-xs text-slate-500">
                Consulte a{" "}
                <Link href="/psicologo/agenda" className="font-semibold text-emerald-800 underline">
                  agenda
                </Link>
                .
              </p>
            </div>
          ) : null}

          {!isRoomPage && (pickableToday.length > 0 || shared?.phase === "patient_waiting") ? (
            <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <header className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-emerald-50/30 px-5 py-5 sm:px-6">
                <h1 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">Salas de hoje</h1>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
                  Abra uma sala para enviar o link da videochamada, ver quando o paciente entra no portal e iniciar o cronômetro do
                  atendimento.
                </p>
              </header>
              <div className="px-5 py-6 sm:px-6">
                <h2 className="text-base font-semibold text-slate-900">Salas disponíveis hoje</h2>
                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">
                  Cada card é uma sala virtual ligada a um horário de hoje. Escolha a sala do atendimento — quando o paciente entrar
                  pelo portal, o card mostra que ele está na fila.
                </p>
                <div className="mt-5 grid min-h-0 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Salas de atendimento disponíveis hoje">
                  {roomCards.map((s, idx) => {
                    const patientInThis = shared?.phase === "patient_waiting" && shared.ref === s.ref;
                    return (
                      <Link
                        key={s.ref}
                        href={psychologistSessionRoomPath(s.ref)}
                        className={`flex min-h-[200px] flex-col rounded-2xl border-2 p-5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${
                          patientInThis
                            ? "border-emerald-500 bg-emerald-50/80 shadow-md ring-2 ring-amber-400 ring-offset-2 ring-offset-white"
                            : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-slate-50/90"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-800">Sala {idx + 1}</span>
                          {patientInThis ? (
                            <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
                              Paciente na sala
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
                        <div className="mt-auto border-t border-slate-200/80 pt-4">
                          <p className="text-xs font-semibold text-emerald-800">Abrir painel desta sala →</p>
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
                  className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-800 hover:underline"
                >
                  ← Voltar às salas de hoje
                </Link>
              </div>
              {!resolvedSession ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                  <p className="text-sm font-medium text-slate-800">Sala não disponível</p>
                  <p className="mt-2 text-xs text-slate-600">
                    Este link não corresponde a um horário de hoje ou a uma sala ativa. Confira o endereço ou volte à lista.
                  </p>
                  <Link
                    href="/psicologo/sessao"
                    className="mt-5 inline-flex rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    Ver salas disponíveis
                  </Link>
                </div>
              ) : (
                <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="px-5 py-6 sm:px-6">
                  <div className="overflow-hidden rounded-2xl border-2 border-emerald-200 bg-gradient-to-b from-emerald-50/50 via-white to-white shadow-inner">
                    <div className="border-b border-emerald-100/90 bg-emerald-600/5 px-5 py-4 sm:px-6">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-800">Nesta sala</p>
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
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white shadow-sm ring-4 ring-white"
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
                              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                            />
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={handleSaveMeetLink}
                                disabled={!selectedRef}
                                className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
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
                                  <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-800">
                                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" aria-hidden />
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
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white shadow-sm ring-4 ring-white"
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
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-950"
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
                              <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-950">
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
                                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                              />
                              Sem paciente na fila: permitir iniciar fora do horário da agenda (demo)
                            </label>

                            <button
                              type="button"
                              disabled={!canStartPrep}
                              onClick={handleStart}
                              aria-label="Iniciar cronômetro da sessão"
                              className="inline-flex w-full max-w-md items-center justify-center gap-2 rounded-full bg-emerald-600 px-6 py-4 text-sm font-semibold text-white shadow-lg shadow-emerald-900/15 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
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
                                className="text-xs font-semibold text-emerald-800 underline hover:text-emerald-950"
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
        <div className="overflow-hidden rounded-2xl border-2 border-emerald-200 bg-gradient-to-b from-white to-emerald-50/40 shadow-xl">
          <div className="border-b border-emerald-100 bg-emerald-50/80 px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-emerald-900">Em andamento · sincronizado</p>
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
                className="mt-2 inline-block text-sm font-semibold text-emerald-800 underline"
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
            <p className="mt-4 font-mono text-6xl font-bold tabular-nums tracking-tight text-emerald-900 sm:text-7xl">
              {formatElapsed(elapsedMs)}
            </p>
            <div className="mt-8 h-3 w-full max-w-md overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-emerald-500 transition-[width] duration-1000 ease-linear"
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
        <Link href="/psicologo/agenda" className="font-medium text-emerald-800 underline">
          Ver agenda
        </Link>
      </p>
    </div>
  );
}
