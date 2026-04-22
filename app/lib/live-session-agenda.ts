/**
 * Janela da consulta só pela agenda (data + hora + duração), no relógio local do navegador.
 */

export function agendaSlotBoundsMs(isoDate: string, timeHHMM: string, durationMin: number): { startMs: number; endMs: number } {
  const [y, m, d] = isoDate.split("-").map(Number);
  const [hh, mm] = timeHHMM.split(":").map(Number);
  const startMs = new Date(y, m - 1, d, hh, mm, 0, 0).getTime();
  const endMs = startMs + durationMin * 60 * 1000;
  return { startMs, endMs };
}

/** Ainda dentro do slot marcado (início … fim). */
export function isInsideAgendaSlot(
  nowMs: number,
  isoDate: string,
  timeHHMM: string,
  durationMin: number,
): boolean {
  const { startMs, endMs } = agendaSlotBoundsMs(isoDate, timeHHMM, durationMin);
  return nowMs >= startMs && nowMs <= endMs;
}

/** Já passou do horário de término marcado. */
export function isPastAgendaSlotEnd(
  nowMs: number,
  isoDate: string,
  timeHHMM: string,
  durationMin: number,
): boolean {
  return nowMs > agendaSlotBoundsMs(isoDate, timeHHMM, durationMin).endMs;
}

/**
 * Outra sessão em localStorage ainda “vale” para bloquear nova entrada?
 * Só enquanto não passou o fim do slot da agenda (ignora só `phase === "ended"`).
 */
export function scheduledSlotStillBlocks(
  phase: "patient_waiting" | "live" | "ended",
  isoDate: string,
  timeHHMM: string,
  durationMin: number,
  nowMs: number,
): boolean {
  if (phase === "ended") return false;
  return !isPastAgendaSlotEnd(nowMs, isoDate, timeHHMM, durationMin);
}

/** Tempo decorrido dentro do slot (0 … duração), para cronômetro alinhado à agenda. */
export function elapsedMsInAgendaSlot(
  nowMs: number,
  isoDate: string,
  timeHHMM: string,
  durationMin: number,
): number {
  const { startMs, endMs } = agendaSlotBoundsMs(isoDate, timeHHMM, durationMin);
  if (nowMs <= startMs) return 0;
  return Math.min(nowMs - startMs, endMs - startMs);
}
