"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  formatLiveElapsed,
  getSharedLiveSession,
  subscribeSharedLiveSession,
  type SharedLiveSessionState,
} from "@/app/lib/live-session-shared";
import { reconcileSharedLiveSessionWithBackend } from "@/app/lib/live-session-backend-sync";
import { psychologistSessionRoomPath } from "@/app/lib/psychologist-session-routes";

function salaHrefForPatient(shared: SharedLiveSessionState): string {
  if (shared.ref.startsWith("portal:")) {
    const id = shared.ref.slice("portal:".length);
    return `/portal/consultas/sala?appointmentId=${encodeURIComponent(id)}`;
  }
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

  const elapsedMs = useMemo(() => {
    if (shared?.phase !== "live" || !shared.startedAtMs) return 0;
    return Math.max(0, Date.now() - shared.startedAtMs);
  }, [shared, tick]);

  if (shared?.phase !== "live" || !shared.startedAtMs) {
    return null;
  }

  const href = role === "patient" ? salaHrefForPatient(shared) : salaHrefForPsychologist(shared);

  return (
    <section
      className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50/80 p-4 shadow-sm sm:p-5"
      aria-live="polite"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-900">Sessão em andamento</p>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-slate-900">{formatLiveElapsed(elapsedMs)}</p>
          <p className="mt-1 text-xs text-slate-600">
            Estado alinhado ao servidor (JWT + consulta em andamento). O cronômetro usa o horário de início gravado no
            backend; ao voltar ao navegador, recarregamos da API.
          </p>
        </div>
        <Link
          href={href}
          className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-center text-sm font-semibold text-white shadow-md transition hover:bg-emerald-700"
        >
          Voltar à sala com cronômetro
        </Link>
      </div>
    </section>
  );
}
