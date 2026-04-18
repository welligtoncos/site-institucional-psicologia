"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  PSYCHOLOGIST_AGENDA_SEED,
  PSYCHOLOGIST_AVAILABILITY_SEED,
  formatIsoDatePt,
  type PsychologistAgendaAppointment,
  type PsychologistAvailabilityMock,
  type TimeBlock,
} from "@/app/lib/psicologo-mocks";

const AVAIL_STORAGE = "psychologist_availability_mock_v1";

function loadBlocks(): TimeBlock[] {
  if (typeof window === "undefined") return PSYCHOLOGIST_AVAILABILITY_SEED.blocks;
  try {
    const raw = localStorage.getItem(AVAIL_STORAGE);
    if (!raw) return PSYCHOLOGIST_AVAILABILITY_SEED.blocks;
    const p = JSON.parse(raw) as PsychologistAvailabilityMock;
    return Array.isArray(p.blocks) ? p.blocks : PSYCHOLOGIST_AVAILABILITY_SEED.blocks;
  } catch {
    return PSYCHOLOGIST_AVAILABILITY_SEED.blocks;
  }
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function sortAppointments(list: PsychologistAgendaAppointment[]): PsychologistAgendaAppointment[] {
  return [...list].sort((a, b) => {
    const c = a.isoDate.localeCompare(b.isoDate);
    if (c !== 0) return c;
    return a.time.localeCompare(b.time);
  });
}

export function PsychologistAgendaView() {
  const [blocks, setBlocks] = useState<TimeBlock[]>(PSYCHOLOGIST_AVAILABILITY_SEED.blocks);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    function refresh() {
      setBlocks(loadBlocks());
    }
    setBlocks(loadBlocks());
    setHydrated(true);
    window.addEventListener("storage", refresh);
    window.addEventListener("psychologist-availability-changed", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("psychologist-availability-changed", refresh);
    };
  }, []);

  const { upcoming, pending, blockedFuture } = useMemo(() => {
    const t = todayIso();
    const sorted = sortAppointments(PSYCHOLOGIST_AGENDA_SEED);
    const upcoming = sorted.filter((a) => a.isoDate >= t && a.status === "confirmada");
    const pending = sorted.filter((a) => a.status === "pendente");
    const blockedFuture = blocks.filter((b) => b.isoDate >= t);
    return { upcoming, pending, blockedFuture: blockedFuture.sort((a, b) => a.isoDate.localeCompare(b.isoDate)) };
  }, [blocks]);

  if (!hydrated) {
    return (
      <div className="rounded-2xl border border-emerald-100 bg-white p-8 text-center text-sm text-slate-600">
        Carregando agenda…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800">Agenda</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Consultas e bloqueios</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Consultas futuras confirmadas, solicitações pendentes e horários que você bloqueou em{" "}
          <Link href="/psicologo/disponibilidade" className="font-semibold text-emerald-800 underline">
            Disponibilidade
          </Link>
          .
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-emerald-900">Próximas (confirmadas)</h2>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-900">{upcoming.length}</span>
          </div>
          {upcoming.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">Nenhuma consulta confirmada a partir de hoje.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {upcoming.map((a) => (
                <li key={a.id} className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3 text-sm">
                  <p className="font-medium text-slate-900">{a.patientName}</p>
                  <p className="text-xs text-slate-600">
                    {formatIsoDatePt(a.isoDate)} · {a.time} · {a.format}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-amber-900">Pendentes de confirmação</h2>
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">{pending.length}</span>
          </div>
          {pending.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">Nenhuma solicitação pendente.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {pending.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-100 bg-amber-50/50 px-3 py-3 text-sm">
                  <div>
                    <p className="font-medium text-slate-900">{a.patientName}</p>
                    <p className="text-xs text-slate-600">
                      {formatIsoDatePt(a.isoDate)} · {a.time} · {a.format}
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">Pendente</span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-800">Horários bloqueados (a partir de hoje)</h2>
          <Link href="/psicologo/disponibilidade" className="text-xs font-semibold text-emerald-700 hover:underline">
            Editar bloqueios
          </Link>
        </div>
        {blockedFuture.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Nenhum bloqueio futuro cadastrado.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {blockedFuture.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
                <span className="font-medium text-slate-900">{formatIsoDatePt(b.isoDate)}</span>
                <span className="text-slate-600">{b.allDay ? "Dia inteiro" : `${b.startTime} – ${b.endTime}`}</span>
                <span className="text-slate-500">{b.note}</span>
              </li>
            ))}
          </ul>
        )}
      </article>
    </div>
  );
}
