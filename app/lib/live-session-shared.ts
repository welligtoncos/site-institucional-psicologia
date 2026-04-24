/**
 * Estado compartilhado entre portal do paciente e área do psicólogo (cache no navegador).
 * Usa localStorage + BroadcastChannel + eventos entre abas.
 *
 * Autoridade: consulta `em_andamento` + `session_started_at` vêm do backend (API autenticada).
 * Use `reconcileSharedLiveSessionWithBackend` após reabrir o app ou periodicamente — não confie só neste cache.
 */

export const LIVE_SESSION_STORAGE_KEY = "clinica_live_session_shared_v1";

/** Exibe tempo decorrido (paciente, psicólogo e banner da home usam o mesmo formato). */
export function formatLiveElapsed(ms: number): string {
  const totalSec = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(totalSec / 3600);
  const min = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${min}:${String(sec).padStart(2, "0")}`;
}

/** Id da consulta a partir de refs do estado compartilhado (`portal:`, `appointment:`, `agenda:`). */
export function extractConsultaIdFromLiveRef(ref: string): string | null {
  if (ref.startsWith("portal:")) {
    const id = ref.slice("portal:".length).trim();
    return id || null;
  }
  if (ref.startsWith("appointment:")) {
    const id = ref.slice("appointment:".length).trim();
    return id || null;
  }
  if (ref.startsWith("agenda:")) {
    const id = ref.slice("agenda:".length).trim();
    return id || null;
  }
  return null;
}

/** Mesma consulta no portal (`portal:uuid`) ou na agenda do psicólogo (`appointment:uuid`). */
export function liveSessionRefsSameConsulta(a: string, b: string): boolean {
  const ia = extractConsultaIdFromLiveRef(a);
  const ib = extractConsultaIdFromLiveRef(b);
  return ia !== null && ib !== null && ia === ib;
}

/** Reservado para simulações futuras; o play libera assim que houver link e paciente na fila. */
export const PSYCH_START_MIN_WAIT_MS = 0;

export type LiveSessionPhase = "patient_waiting" | "live" | "ended";

export type SharedLiveSessionState = {
  version: 1;
  ref: string;
  phase: LiveSessionPhase;
  patientName: string;
  psychologistName: string;
  isoDate: string;
  time: string;
  durationMin: number;
  format: string;
  /** Link da videochamada (Meet, Zoom etc.) definido pelo psicólogo — visível na sala de espera. */
  meetUrl?: string;
  /** A partir deste instante o psicólogo pode clicar em Iniciar sessão (paciente com link na sala). */
  psychUnlockStartButtonAtMs?: number;
  patientJoinedAtMs?: number;
  startedAtMs?: number;
  endedAtMs?: number;
  updatedAtMs: number;
};

const CHANNEL_NAME = "clinica_live_session_v1";

export const LIVE_SESSION_EVENT = "clinica-live-session-changed";

function parseState(raw: string | null): SharedLiveSessionState | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as SharedLiveSessionState;
    if (p.version !== 1 || typeof p.ref !== "string" || typeof p.phase !== "string") return null;
    return p;
  } catch {
    return null;
  }
}

export function getSharedLiveSession(): SharedLiveSessionState | null {
  if (typeof window === "undefined") return null;
  return parseState(localStorage.getItem(LIVE_SESSION_STORAGE_KEY));
}

/** Canal mantido aberto: abrir/postar/fechar na mesma macro-tarefa pode falhar em outras abas (mensagem perdida). */
let outboundBroadcastChannel: BroadcastChannel | null = null;

function getOutboundBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  try {
    if (!outboundBroadcastChannel) {
      outboundBroadcastChannel = new BroadcastChannel(CHANNEL_NAME);
    }
    return outboundBroadcastChannel;
  } catch {
    return null;
  }
}

function broadcast(): void {
  if (typeof window === "undefined") return;
  const bc = getOutboundBroadcastChannel();
  if (bc) {
    try {
      bc.postMessage({ t: "ping", at: Date.now() });
    } catch {
      outboundBroadcastChannel = null;
    }
  }
  window.dispatchEvent(new Event(LIVE_SESSION_EVENT));
}

function applyPsychStartUnlockGate(
  prev: SharedLiveSessionState | null,
  next: SharedLiveSessionState,
): SharedLiveSessionState {
  if (next.phase === "live" || next.phase === "ended") {
    const { psychUnlockStartButtonAtMs: _u, ...rest } = next;
    return { ...rest, psychUnlockStartButtonAtMs: undefined };
  }

  const hasLink = Boolean(next.meetUrl?.trim());
  const both = next.phase === "patient_waiting" && hasLink;

  if (!both) {
    return { ...next, psychUnlockStartButtonAtMs: undefined };
  }

  const prevBoth =
    prev !== null &&
    prev.ref === next.ref &&
    prev.phase === "patient_waiting" &&
    Boolean(prev.meetUrl?.trim());

  if (prevBoth && prev.psychUnlockStartButtonAtMs !== undefined) {
    return { ...next, psychUnlockStartButtonAtMs: prev.psychUnlockStartButtonAtMs };
  }

  return { ...next, psychUnlockStartButtonAtMs: Date.now() + PSYCH_START_MIN_WAIT_MS };
}

export function setSharedLiveSession(state: SharedLiveSessionState): void {
  if (typeof window === "undefined") return;
  const prev = getSharedLiveSession();
  const merged = applyPsychStartUnlockGate(prev, state);
  localStorage.setItem(LIVE_SESSION_STORAGE_KEY, JSON.stringify(merged));
  broadcast();
}

export function clearSharedLiveSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LIVE_SESSION_STORAGE_KEY);
  broadcast();
}

const PENDING_MEET_KEY = "clinica_live_pending_meet_v1";
const PSYCHOLOGIST_ENTERED_KEY = "clinica_psychologist_entered_rooms_v1";

function readPendingMap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(PENDING_MEET_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as Record<string, string>;
    return p && typeof p === "object" ? p : {};
  } catch {
    return {};
  }
}

/** Link salvo antes do paciente entrar na sala (mesma ref da consulta). */
export function getPendingMeetUrl(ref: string): string | undefined {
  const v = readPendingMap()[ref];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export function setPendingMeetUrl(ref: string, url: string): void {
  if (typeof window === "undefined") return;
  const map = readPendingMap();
  const t = url.trim();
  if (t) map[ref] = t;
  else delete map[ref];
  localStorage.setItem(PENDING_MEET_KEY, JSON.stringify(map));
  broadcast();
}

export function clearPendingMeetUrl(ref: string): void {
  if (typeof window === "undefined") return;
  const map = readPendingMap();
  if (!(ref in map)) return;
  delete map[ref];
  localStorage.setItem(PENDING_MEET_KEY, JSON.stringify(map));
  broadcast();
}

/** Atualiza o link na sessão ativa (paciente já na sala ou sessão ao vivo). */
export function patchSharedLiveSessionMeetUrl(ref: string, meetUrl: string): void {
  const cur = getSharedLiveSession();
  if (!cur || cur.ref !== ref || cur.phase === "ended") return;
  const t = meetUrl.trim();
  setSharedLiveSession({
    ...cur,
    meetUrl: t || undefined,
    updatedAtMs: Date.now(),
  });
}

function readPsychologistEnteredMap(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(PSYCHOLOGIST_ENTERED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

/** Marca que o psicólogo abriu o painel da sala (sinal em tempo real para o paciente). */
export function markPsychologistRoomEntered(ref: string): void {
  if (typeof window === "undefined") return;
  const map = readPsychologistEnteredMap();
  map[ref] = Date.now();
  localStorage.setItem(PSYCHOLOGIST_ENTERED_KEY, JSON.stringify(map));
  broadcast();
}

export function clearPsychologistRoomEntered(ref: string): void {
  if (typeof window === "undefined") return;
  const map = readPsychologistEnteredMap();
  if (!(ref in map)) return;
  delete map[ref];
  localStorage.setItem(PSYCHOLOGIST_ENTERED_KEY, JSON.stringify(map));
  broadcast();
}

export function getPsychologistRoomEnteredAt(ref: string): number | undefined {
  const value = readPsychologistEnteredMap()[ref];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function isPsychologistRoomEnteredActive(ref: string, maxAgeMs: number = 10_000): boolean {
  const enteredAt = getPsychologistRoomEnteredAt(ref);
  if (!enteredAt) return false;
  return Date.now() - enteredAt <= maxAgeMs;
}

export function subscribeSharedLiveSession(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handler = () => onChange();
  window.addEventListener(LIVE_SESSION_EVENT, handler);
  window.addEventListener("storage", handler);

  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel(CHANNEL_NAME);
    bc.onmessage = () => onChange();
  } catch {
    /* ignore */
  }

  const poll = window.setInterval(() => onChange(), 400);

  return () => {
    window.removeEventListener(LIVE_SESSION_EVENT, handler);
    window.removeEventListener("storage", handler);
    if (bc) bc.close();
    window.clearInterval(poll);
  };
}
