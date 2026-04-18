"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  PSYCHOLOGIST_PATIENTS_SEED,
  formatIsoDatePt,
  loadAgendaAppointments,
  patientStatusLabel,
  type PsychologistAgendaAppointment,
  type PsychologistPatient,
} from "@/app/lib/psicologo-mocks";

function statusStyles(s: PsychologistPatient["status"]) {
  if (s === "ativo") return "bg-emerald-100 text-emerald-900";
  if (s === "acompanhamento") return "bg-sky-100 text-sky-900";
  return "bg-slate-200 text-slate-700";
}

export function PsychologistPatientsBoard() {
  const [agenda, setAgenda] = useState<PsychologistAgendaAppointment[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const refresh = useCallback(() => {
    setAgenda(loadAgendaAppointments());
  }, []);

  useEffect(() => {
    refresh();
    setHydrated(true);
    window.addEventListener("storage", refresh);
    window.addEventListener("psychologist-agenda-changed", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("psychologist-agenda-changed", refresh);
    };
  }, [refresh]);

  const byPatient = useMemo(() => {
    const map = new Map<string, PsychologistAgendaAppointment[]>();
    for (const a of agenda) {
      const list = map.get(a.patientId) ?? [];
      list.push(a);
      map.set(a.patientId, list);
    }
    for (const [, list] of map) {
      list.sort((x, y) => {
        const c = x.isoDate.localeCompare(y.isoDate);
        if (c !== 0) return c;
        return x.time.localeCompare(y.time);
      });
    }
    return map;
  }, [agenda]);

  function openProntuario(p: PsychologistPatient) {
    toast.success(`Prontuário de ${p.name} — modo demonstração (sem dados clínicos).`);
  }

  if (!hydrated) {
    return (
      <div className="rounded-2xl border border-emerald-100 bg-white p-8 text-center text-sm text-slate-600">
        Carregando pacientes…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800">Pacientes</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Lista e histórico</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Cadastro básico fictício, status e sessões vinculadas à agenda mockada. O botão de prontuário apenas simula o
          acesso — não armazena conteúdo clínico.
        </p>
      </section>

      <div className="space-y-4">
        {PSYCHOLOGIST_PATIENTS_SEED.map((p) => {
          const sessions = byPatient.get(p.id) ?? [];
          const recent = [...sessions].filter((a) => a.status !== "cancelada").slice(-5);
          return (
            <article key={p.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{p.name}</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {p.email} · {p.phone}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    Primeira consulta (mock): {formatIsoDatePt(p.firstVisitIso)} · Registros: {p.sessionsCount} sessões
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles(p.status)}`}>
                    {patientStatusLabel(p.status)}
                  </span>
                  <button
                    type="button"
                    onClick={() => openProntuario(p)}
                    className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100"
                  >
                    Abrir prontuário
                  </button>
                </div>
              </div>

              <div className="mt-4 border-t border-slate-100 pt-4">
                <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Histórico de atendimentos (agenda)</h3>
                {recent.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">Nenhuma sessão na agenda mock para este paciente.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {recent.map((a) => (
                      <li
                        key={a.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm"
                      >
                        <span className="text-slate-900">
                          {formatIsoDatePt(a.isoDate)} · {a.time}
                        </span>
                        <span className="text-xs text-slate-600">
                          {a.format}
                          {a.status === "cancelada" && (
                            <span className="ml-2 text-rose-700">Cancelada</span>
                          )}
                          {a.status === "pendente" && (
                            <span className="ml-2 text-amber-700">Pendente</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
