"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { MOCK_PSYCHOLOGIST, formatAppointmentDatePt, type MockAppointment } from "@/app/lib/portal-mocks";
import { getPatientAppointments } from "@/app/lib/portal-payment-mock";
import {
  clearSharedLiveSession,
  getPendingMeetUrl,
  getSharedLiveSession,
  setSharedLiveSession,
  subscribeSharedLiveSession,
  clearPendingMeetUrl,
  type SharedLiveSessionState,
} from "@/app/lib/live-session-shared";
import { todayIso } from "@/app/lib/psicologo-mocks";

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

export function PatientLiveSessionBoard() {
  const [today] = useState(() => todayIso());
  const [appointments, setAppointments] = useState<MockAppointment[]>([]);
  const [shared, setShared] = useState<SharedLiveSessionState | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => {
    setAppointments(getPatientAppointments());
    setShared(getSharedLiveSession());
  }, []);

  useEffect(() => {
    refresh();
    const unsub = subscribeSharedLiveSession(refresh);
    const id = window.setInterval(() => setTick((x) => x + 1), 1000);
    window.addEventListener("portal-billing-changed", refresh);
    function onWindowFocus() {
      refresh();
    }
    function onVisibilityChange() {
      if (document.visibilityState === "visible") refresh();
    }
    window.addEventListener("focus", onWindowFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pageshow", onWindowFocus);
    return () => {
      unsub();
      window.clearInterval(id);
      window.removeEventListener("portal-billing-changed", refresh);
      window.removeEventListener("focus", onWindowFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pageshow", onWindowFocus);
    };
  }, [refresh]);

  /** Consultas futuras ou hoje — o seed pode não ter “hoje”; assim o demo continua utilizável. */
  const eligibleSessions = useMemo(() => {
    return appointments
      .filter(
        (a) =>
          a.psychId === MOCK_PSYCHOLOGIST.id &&
          a.status !== "cancelada" &&
          a.status !== "realizada" &&
          a.isoDate >= today,
      )
      .sort((a, b) => {
        const d = a.isoDate.localeCompare(b.isoDate);
        if (d !== 0) return d;
        return a.time.localeCompare(b.time);
      });
  }, [appointments, today]);

  function handleEnterWaiting(apt: MockAppointment) {
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
    const pendingMeet = getPendingMeetUrl(ref);
    const next: SharedLiveSessionState = {
      version: 1,
      ref,
      phase: "patient_waiting",
      patientName: apt.patientName?.trim() || `Paciente (consulta ${apt.id})`,
      psychologistName: MOCK_PSYCHOLOGIST.name,
      isoDate: apt.isoDate,
      time: apt.time,
      durationMin: apt.durationMin,
      format: apt.format,
      meetUrl: pendingMeet,
      patientJoinedAtMs: Date.now(),
      updatedAtMs: Date.now(),
    };
    setSharedLiveSession(next);
    toast.success(
      "Você está na sala de espera. Aguarde o link no painel do psicólogo; quando a sessão for iniciada (play), o cronômetro aparece aqui.",
    );
  }

  /** Sai da sala de espera sem encerrar consulta no portal — pode entrar de novo quando quiser. */
  function handleLeaveWaitingRoom(apt: MockAppointment) {
    const ref = portalRef(apt.id);
    const cur = getSharedLiveSession();
    if (!cur || cur.ref !== ref || cur.phase !== "patient_waiting") {
      toast.message("Não há sala de espera ativa para sair.");
      return;
    }
    clearSharedLiveSession();
    setShared(null);
    toast.success("Você saiu da sala de espera. Pode voltar a qualquer momento clicando em Entrar novamente.");
  }

  function handleDismissEnded() {
    const ref = shared?.ref;
    clearSharedLiveSession();
    if (ref) clearPendingMeetUrl(ref);
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
          Primeiro você <strong className="font-semibold text-slate-800">aguarda o link</strong> que o psicólogo envia pelo painel.
          Quando o link aparecer aqui, é sinal de que <strong className="font-semibold text-slate-800">ele está pronto na sala</strong>.
          Você entra na Meet/Zoom; quando ele apertar <strong className="font-semibold text-slate-800">play</strong>, esta página passa
          para <strong className="font-semibold text-slate-800">sessão iniciada</strong> com o mesmo cronômetro. Só a sala de espera não
          liga o tempo.
        </p>
      </section>

      {eligibleSessions.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-slate-600">Não há consultas futuras no portal (demonstração).</p>
          <Link href="/portal/consultas" className="mt-3 inline-block text-sm font-semibold text-sky-700 underline">
            Ver consultas
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {eligibleSessions.map((apt) => {
            const ref = portalRef(apt.id);
            const isThis = shared?.ref === ref;
            const phase = isThis ? shared?.phase : null;

            return (
              <article
                key={apt.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-4">
                  <p className="text-sm font-semibold text-slate-900">
                    {formatAppointmentDatePt(apt.isoDate)} · {apt.time}
                    {apt.isoDate === today ? (
                      <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-900">
                        Hoje
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-slate-600">
                    {MOCK_PSYCHOLOGIST.name} · {apt.format} ·{" "}
                    {apt.status === "realizada"
                      ? "Concluída"
                      : apt.status === "agendada"
                        ? "Agendada"
                        : apt.status === "confirmada"
                          ? "Confirmada"
                          : apt.status === "cancelada"
                            ? "Cancelada"
                            : apt.status}
                  </p>
                </div>

                <div className="p-5">
                  {!isThis || !phase ? (
                    <div className="space-y-3">
                      <p className="text-sm text-slate-600">
                        Na hora do atendimento, entre na sala de espera: você aguarda o link do psicólogo, vê quando a sala está pronta e,
                        após o play no painel dele, esta página mostra a sessão iniciada com o cronômetro.
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
                    <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-6 text-center">
                      <div className="mx-auto mb-3 flex h-14 w-14 animate-pulse items-center justify-center rounded-full bg-amber-200 text-2xl">
                        ◉
                      </div>
                      <p className="font-semibold text-amber-950">Você está na sala de espera</p>
                      <p className="sr-only">Estado do fluxo: aguardando link, profissional pronto ou sessão iniciada.</p>
                      <div
                        className="mx-auto mt-4 grid max-w-lg grid-cols-3 gap-1 rounded-xl border border-amber-300/70 bg-white/70 p-1 text-[10px] font-bold uppercase leading-tight tracking-wide text-amber-900/70 sm:text-[11px]"
                        role="tablist"
                        aria-label="Progresso do atendimento"
                      >
                        <span
                          className={`rounded-lg px-1 py-2.5 sm:px-2 ${
                            !shared.meetUrl?.trim() ? "bg-amber-200 text-amber-950 shadow-sm" : "text-amber-800/75"
                          }`}
                        >
                          1 · Aguardando o link
                        </span>
                        <span
                          className={`rounded-lg px-1 py-2.5 sm:px-2 ${
                            shared.meetUrl?.trim() ? "bg-amber-200 text-amber-950 shadow-sm" : "opacity-55"
                          }`}
                        >
                          2 · Profissional pronto
                        </span>
                        <span className="rounded-lg px-1 py-2.5 opacity-50 sm:px-2">3 · Sessão iniciada</span>
                      </div>
                      <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-amber-900/95">
                        <strong className="text-amber-950">Só esta espera não liga o cronômetro.</strong>{" "}
                        {!shared.meetUrl?.trim() ? (
                          <>
                            Aguarde <strong>{shared.psychologistName}</strong> enviar o link pelo painel — quando ele aparecer aqui, você
                            sabe que o profissional está pronto na sala.
                          </>
                        ) : (
                          <>
                            <strong>{shared.psychologistName}</strong> já enviou o link: use-o para entrar na Meet/Zoom. Quando o
                            profissional <strong className="text-amber-950">der play no painel</strong>, esta página passa para a etapa{" "}
                            <strong className="text-amber-950">sessão iniciada</strong> com o tempo oficial.
                          </>
                        )}
                      </p>
                      {shared.meetUrl?.trim() ? (
                        <div className="mt-5 rounded-xl border border-amber-300/80 bg-white px-4 py-4 text-left shadow-sm">
                          <p className="text-xs font-semibold text-emerald-900">
                            Link recebido — você pode ver que o profissional está pronto na sala (demonstração).
                          </p>
                          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-amber-900">Link da videochamada</p>
                          <p className="mt-2 break-all font-mono text-xs text-slate-800">{shared.meetUrl}</p>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <a
                              href={shared.meetUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex rounded-full bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700"
                            >
                              Abrir na nova aba
                            </a>
                            <button
                              type="button"
                              onClick={() => {
                                void navigator.clipboard.writeText(shared.meetUrl!).then(() =>
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
                        <p className="mt-4 text-xs text-amber-800/90">
                          O link surge aqui automaticamente quando o psicólogo salvar no painel dele.
                        </p>
                      )}
                      <div className="mt-6 flex flex-wrap items-center justify-center gap-3 border-t border-amber-200/80 pt-5">
                        <button
                          type="button"
                          onClick={() => handleLeaveWaitingRoom(apt)}
                          className="rounded-full border border-slate-400 bg-white px-6 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                        >
                          Sair da sala de espera
                        </button>
                      </div>
                      <p className="mt-3 text-[11px] leading-relaxed text-amber-900/80">
                        Atualização automática. Sair só remove você da fila neste dispositivo (demo); o psicólogo passa a ver a sala
                        fechada até você entrar de novo.
                      </p>
                    </div>
                  ) : null}

                  {isThis && phase === "live" && shared?.startedAtMs ? (
                    <div className="rounded-xl border border-emerald-200 bg-gradient-to-b from-emerald-50/80 to-white px-4 py-8 text-center">
                      <div
                        className="mx-auto grid max-w-lg grid-cols-3 gap-1 rounded-xl border border-emerald-200/80 bg-white/80 p-1 text-[10px] font-bold uppercase leading-tight tracking-wide text-emerald-900/60 sm:text-[11px]"
                        role="tablist"
                        aria-label="Progresso do atendimento"
                      >
                        <span className="rounded-lg bg-emerald-100/90 px-1 py-2.5 text-emerald-900 sm:px-2">1 · Link</span>
                        <span className="rounded-lg bg-emerald-100/90 px-1 py-2.5 text-emerald-900 sm:px-2">2 · Pronto</span>
                        <span className="rounded-lg bg-emerald-600 px-1 py-2.5 text-white shadow-sm sm:px-2">3 · Sessão iniciada</span>
                      </div>
                      <p className="mx-auto mt-4 max-w-lg text-sm font-semibold leading-snug text-emerald-950">
                        <strong className="text-emerald-950">Sessão iniciada</strong> — o mesmo cronômetro do painel de{" "}
                        <strong>{shared.psychologistName}</strong>, após o play. Você pode seguir na Meet/Zoom nesta ou em outra aba.
                      </p>
                      {shared.meetUrl ? (
                        <p className="mx-auto mt-3 max-w-lg text-xs text-slate-600">
                          Link da chamada:{" "}
                          <a
                            href={shared.meetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-emerald-800 underline"
                          >
                            abrir na nova aba
                          </a>
                        </p>
                      ) : null}
                      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800">
                        Atendimento em andamento · tempo oficial
                      </p>
                      <p className="mt-4 font-mono text-5xl font-bold tabular-nums text-emerald-900 sm:text-6xl">
                        {formatElapsed(elapsedMs)}
                      </p>
                      <div className="mx-auto mt-6 h-2 max-w-xs overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-[width] duration-1000 ease-linear"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      <p className="mt-4 text-xs text-slate-600">
                        Este tempo é o mesmo que o psicólogo vê ao vivo — demonstração sincronizada no navegador.
                      </p>
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
                        Duração registrada no mock: {shared.startedAtMs ? formatElapsed(shared.endedAtMs - shared.startedAtMs) : "—"}
                      </p>
                      <button
                        type="button"
                        onClick={handleDismissEnded}
                        className="mt-5 rounded-full border border-slate-300 bg-white px-6 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-100"
                      >
                        Ok, entendi
                      </button>
                    </div>
                  ) : null}
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
      </p>
    </div>
  );
}
