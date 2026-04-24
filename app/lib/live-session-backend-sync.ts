/**
 * Reconcilia o estado de sessão ao vivo com a API (JWT + dados do banco).
 * O localStorage só é atualizado a partir da resposta autoritativa — não se confia
 * no cache sozinho após reabrir o navegador.
 */

import {
  clearSharedLiveSession,
  getSharedLiveSession,
  liveSessionChronoExceeded,
  setSharedLiveSession,
  type SharedLiveSessionState,
} from "@/app/lib/live-session-shared";
import { listPatientAppointments, type ApiPatientAppointmentSummary } from "@/app/lib/portal-appointments-api";
import { apiAgendaToMock, fetchPsychologistAgenda } from "@/app/lib/psychologist-agenda-api";
import type { PsychologistAgendaAppointment } from "@/app/lib/psicologo-mocks";

function isoDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isPatientPortalRef(ref: string): boolean {
  return ref.startsWith("portal:");
}

function isPsychologistAgendaRef(ref: string): boolean {
  return ref.startsWith("appointment:") || ref.startsWith("agenda:");
}

function patientApiChronoStillWithinDuration(a: ApiPatientAppointmentSummary): boolean {
  const raw = a.session_started_at?.trim();
  if (!raw) return true;
  const started = Date.parse(raw);
  if (!Number.isFinite(started)) return true;
  return !liveSessionChronoExceeded(started, a.duration_min ?? 50);
}

function pickPatientLiveFromRows(rows: ApiPatientAppointmentSummary[]): ApiPatientAppointmentSummary | null {
  const candidates = rows.filter(
    (a) =>
      a.status === "em_andamento" &&
      a.format === "Online" &&
      Boolean(a.session_started_at?.trim()) &&
      patientApiChronoStillWithinDuration(a),
  );
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    const ta = Date.parse(a.session_started_at!);
    const tb = Date.parse(b.session_started_at!);
    return ta - tb;
  });
  return candidates[0] ?? null;
}

function psychAgendaChronoStillWithinDuration(a: PsychologistAgendaAppointment): boolean {
  const raw = a.sessionStartedAt?.trim();
  if (!raw) return true;
  const started = Date.parse(raw);
  if (!Number.isFinite(started)) return true;
  return !liveSessionChronoExceeded(started, a.durationMin ?? 50);
}

function pickPsychologistLiveFromRows(rows: PsychologistAgendaAppointment[]): PsychologistAgendaAppointment | null {
  const candidates = rows.filter(
    (a) =>
      a.status === "em_andamento" &&
      a.format === "Online" &&
      Boolean(a.sessionStartedAt?.trim()) &&
      psychAgendaChronoStillWithinDuration(a),
  );
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    const ta = Date.parse(a.sessionStartedAt!);
    const tb = Date.parse(b.sessionStartedAt!);
    return ta - tb;
  });
  return candidates[0] ?? null;
}

function patientRowToShared(apt: ApiPatientAppointmentSummary): SharedLiveSessionState {
  const startedAtMs = Date.parse(apt.session_started_at!);
  return {
    version: 1,
    ref: `portal:${apt.id}`,
    phase: "live",
    patientName: (apt.patient_name || "Paciente").trim(),
    psychologistName: (apt.psychologist_name || "Profissional").trim(),
    isoDate: apt.iso_date,
    time: apt.time,
    durationMin: apt.duration_min,
    format: apt.format,
    meetUrl: apt.video_call_link?.trim() || undefined,
    startedAtMs,
    updatedAtMs: Date.now(),
  };
}

function psychRowToShared(apt: PsychologistAgendaAppointment): SharedLiveSessionState {
  const startedAtMs = Date.parse(apt.sessionStartedAt!);
  return {
    version: 1,
    ref: `appointment:${apt.id}`,
    phase: "live",
    patientName: (apt.patientName || "Paciente").trim(),
    psychologistName: "Psicólogo",
    isoDate: apt.isoDate,
    time: apt.time,
    durationMin: apt.durationMin ?? 50,
    format: apt.format,
    meetUrl: apt.videoCallLink?.trim() || undefined,
    startedAtMs,
    updatedAtMs: Date.now(),
  };
}

/**
 * Busca consulta online em andamento no backend e alinha o `SharedLiveSessionState`.
 * - Se a API confirmar sessão ativa: grava estado derivado só dos campos da API.
 * - Se a API não tiver sessão ativa (ou o cache local estiver obsoleto): remove estado `live` deste papel.
 * Não substitui validação nos endpoints `join-room` (sempre autoritativos no servidor).
 */
export async function reconcileSharedLiveSessionWithBackend(role: "patient" | "psychologist"): Promise<void> {
  const cur = getSharedLiveSession();

  if (role === "patient") {
    const res = await listPatientAppointments(isoDateDaysAgo(120));
    if (!res.ok) return;

    const live = pickPatientLiveFromRows(res.data.appointments);
    if (live) {
      setSharedLiveSession(patientRowToShared(live));
      return;
    }

    if (cur?.phase === "live" && isPatientPortalRef(cur.ref)) {
      // #region agent log
      const staleChronoCount = res.data.appointments.filter((a) => {
        if (a.status !== "em_andamento" || a.format !== "Online") return false;
        const raw = a.session_started_at?.trim();
        if (!raw) return false;
        const st = Date.parse(raw);
        if (!Number.isFinite(st)) return false;
        return liveSessionChronoExceeded(st, a.duration_min ?? 50);
      }).length;
      fetch("http://127.0.0.1:7934/ingest/ae301534-ea0d-4f7b-a7be-1472a98c06a7", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "6327f2" },
        body: JSON.stringify({
          sessionId: "6327f2",
          runId: "chrono-verify",
          hypothesisId: "H1",
          location: "live-session-backend-sync.ts:reconcilePatientClear",
          message: "reconcile clearing patient portal live (no row within chrono)",
          data: { staleChronoCount, hadCurLive: true },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      clearSharedLiveSession();
    }
    return;
  }

  const res = await fetchPsychologistAgenda(isoDateDaysAgo(21));
  if (!res.ok || !("appointments" in res.data)) return;

  const mapped = apiAgendaToMock(res.data).appointments;
  const live = pickPsychologistLiveFromRows(mapped);
  if (live) {
    setSharedLiveSession(psychRowToShared(live));
    return;
  }

  if (cur?.phase === "live" && isPsychologistAgendaRef(cur.ref)) {
    clearSharedLiveSession();
  }
}
