"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  clearSharedLiveSession,
  extractConsultaIdFromLiveRef,
  formatLiveElapsed,
  getSharedLiveSession,
  liveSessionChronoExceeded,
  subscribeSharedLiveSession,
  type SharedLiveSessionState,
} from "@/app/lib/live-session-shared";
import { reconcileSharedLiveSessionWithBackend } from "@/app/lib/live-session-backend-sync";
import { psychologistSessionRoomPath } from "@/app/lib/psychologist-session-routes";

function salaHrefForPatient(shared: SharedLiveSessionState): string {
  const id = extractConsultaIdFromLiveRef(shared.ref);
  if (id) return `/portal/consultas/sala?appointmentId=${encodeURIComponent(id)}`;
  return "/portal/consultas/sala";
}

function salaHrefForPsychologist(shared: SharedLiveSessionState): string {
  return psychologistSessionRoomPath(shared.ref);
}

type LiveSessionHomeBannerProps = {
  role: "patient" | "psychologist";
};

export function LiveSessionHomeBanner({ role }: LiveSessionHomeBannerProps) {
  const [shared, setShared] = useState<SharedLiveSessionState | null>(null);
  const [tick, setTick] = useState(0);

  const pull = useCallback(() => {
    setShared(getSharedLiveSession());
  }, []);

  const pullAfterReconcile = useCallback(async () => {
    await reconcileSharedLiveSessionWithBackend(role);
    pull();
  }, [role, pull]);

  useEffect(() => {
    void pullAfterReconcile();
    return subscribeSharedLiveSession(pull);
  }, [pull, pullAfterReconcile]);

  useEffect(() => {
    const onFocus = () => {
      void pullAfterReconcile();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [pullAfterReconcile]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void pullAfterReconcile();
    }, 8000);
    return () => window.clearInterval(id);
  }, [pullAfterReconcile]);

  useEffect(() => {
    if (shared?.phase !== "live" || !shared.startedAtMs) return;
    const id = window.setInterval(() => setTick((x) => x + 1), 1000);
    return () => window.clearInterval(id);
  }, [shared?.phase, shared?.startedAtMs]);

  /** Se a API atrasar `realizada`, não manter o banner após fim do tempo previsto (início + duração). */
  useEffect(() => {
    if (shared?.phase !== "live" || !shared.startedAtMs) return;
    if (!liveSessionChronoExceeded(shared.startedAtMs, shared.durationMin)) return;
    // #region agent log
    fetch("http://127.0.0.1:7934/ingest/ae301534-ea0d-4f7b-a7be-1472a98c06a7", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "6327f2" },
      body: JSON.stringify({
        sessionId: "6327f2",
        runId: "chrono-verify",
        hypothesisId: "H3",
        location: "LiveSessionHomeBanner.tsx:chronoClear",
        message: "banner clearing shared after chrono exceeded",
        data: {
          role,
          startedAtMs: shared.startedAtMs,
          durationMin: shared.durationMin,
          nowMs: Date.now(),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    clearSharedLiveSession();
    pull();
  }, [shared, tick, pull, role]);

  const elapsedMs = useMemo(() => {
    if (shared?.phase !== "live" || !shared.startedAtMs) return 0;
    return Math.max(0, Date.now() - shared.startedAtMs);
  }, [shared, tick]);

  if (shared?.phase !== "live" || !shared.startedAtMs) {
    return null;
  }

  const href = role === "patient" ? salaHrefForPatient(shared) : salaHrefForPsychologist(shared);
  const backToSalaLabel =
    role === "patient" ? "Voltar à sala de atendimento" : "Voltar à sala com cronômetro";

  return (
    <section
      className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50/80 p-4 shadow-sm sm:p-5"
      aria-live="polite"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-900">Sessão em andamento</p>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-slate-900">{formatLiveElapsed(elapsedMs)}</p>
        </div>
        <Link
          href={href}
          className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-center text-sm font-semibold text-white shadow-md transition hover:bg-emerald-700"
        >
          {backToSalaLabel}
        </Link>
      </div>
    </section>
  );
}
