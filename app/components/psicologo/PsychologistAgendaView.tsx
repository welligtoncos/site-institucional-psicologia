"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  formatIsoDateLong,
  formatIsoDatePt,
  todayIso,
  type PsychologistAgendaAppointment,
  type TimeBlock,
} from "@/app/lib/psicologo-mocks";
import {
  apiAgendaToMock,
  fetchPsychologistAgenda,
} from "@/app/lib/psychologist-agenda-api";

type ViewMode = "dia" | "semana" | "mes";

function sortAppointments(list: PsychologistAgendaAppointment[]): PsychologistAgendaAppointment[] {
  return [...list].sort((a, b) => {
    const c = a.isoDate.localeCompare(b.isoDate);
    if (c !== 0) return c;
    return a.time.localeCompare(b.time);
  });
}

function parseIsoToLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfWeekMonday(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function PsychologistAgendaView() {
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [appointments, setAppointments] = useState<PsychologistAgendaAppointment[]>([]);
  const [loadError, setLoadError] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<ViewMode>("dia");
  const [dayCursor, setDayCursor] = useState(() => todayIso());
  const [weekStart, setWeekStart] = useState(() => toIso(startOfWeekMonday(new Date())));
  const [monthCursor, setMonthCursor] = useState(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });

  const refreshAgenda = useCallback(async () => {
    const fromDateIso = todayIso();
    const result = await fetchPsychologistAgenda(fromDateIso);
    if (result.ok && "appointments" in result.data && "blocks" in result.data) {
      const mapped = apiAgendaToMock(result.data);
      setAppointments(sortAppointments(mapped.appointments));
      setBlocks(mapped.blocks);
      setLoadError("");
      return;
    }
    setAppointments([]);
    setBlocks([]);
    setLoadError(
      "Não foi possível carregar a agenda pela API. Verifique sua sessão e se o backend já possui consultas persistidas.",
    );
  }, []);

  useEffect(() => {
    const onAvailabilityChanged = () => {
      void refreshAgenda();
    };
    void refreshAgenda();
    setHydrated(true);
    window.addEventListener("psychologist-availability-changed", onAvailabilityChanged);
    window.addEventListener("storage", onAvailabilityChanged);
    window.addEventListener("psychologist-agenda-changed", onAvailabilityChanged);
    return () => {
      window.removeEventListener("psychologist-availability-changed", onAvailabilityChanged);
      window.removeEventListener("storage", onAvailabilityChanged);
      window.removeEventListener("psychologist-agenda-changed", onAvailabilityChanged);
    };
  }, [refreshAgenda]);

  const t = todayIso();
  const blockedFuture = useMemo(() => {
    return blocks.filter((b) => b.isoDate >= t).sort((a, b) => a.isoDate.localeCompare(b.isoDate));
  }, [blocks, t]);

  const listForDay = useMemo(() => {
    return sortAppointments(appointments.filter((a) => a.isoDate === dayCursor));
  }, [appointments, dayCursor]);

  const weekDays = useMemo(() => {
    const start = parseIsoToLocal(weekStart);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [weekStart]);

  const weekAppointmentsByDay = useMemo(() => {
    const map = new Map<string, PsychologistAgendaAppointment[]>();
    for (const d of weekDays) {
      map.set(toIso(d), []);
    }
    for (const a of appointments) {
      if (!map.has(a.isoDate)) continue;
      map.get(a.isoDate)!.push(a);
    }
    for (const [, arr] of map) {
      arr.sort((x, y) => x.time.localeCompare(y.time));
    }
    return map;
  }, [appointments, weekDays]);

  const monthYear = monthCursor.getFullYear();
  const monthIndex = monthCursor.getMonth();

  const monthAppointments = useMemo(() => {
    return sortAppointments(
      appointments.filter((a) => {
        const [y, m] = a.isoDate.split("-").map(Number);
        return y === monthYear && m - 1 === monthIndex;
      }),
    );
  }, [appointments, monthYear, monthIndex]);

  const monthGrouped = useMemo(() => {
    const groups = new Map<string, PsychologistAgendaAppointment[]>();
    for (const a of monthAppointments) {
      const prev = groups.get(a.isoDate) ?? [];
      prev.push(a);
      groups.set(a.isoDate, prev);
    }
    return groups;
  }, [monthAppointments]);

  function renderSessionCard(a: PsychologistAgendaAppointment, compact?: boolean) {
    const cancelled = a.status === "cancelada";
    const pending = a.status === "pendente";
    const done = a.status === "realizada";
    return (
      <li
        key={a.id}
        className={`rounded-xl border px-3 py-2 text-sm ${
          cancelled
            ? "border-slate-200 bg-slate-100/80 opacity-70"
            : done
              ? "border-emerald-200 bg-emerald-50/70"
              : pending
                ? "border-amber-200 bg-amber-50/60"
                : "border-emerald-100 bg-white"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p
              className={`font-medium ${
                cancelled ? "line-through text-slate-500" : done ? "text-emerald-900" : "text-slate-900"
              }`}
            >
              {a.patientName}
            </p>
            <p className="text-xs text-slate-600">
              {a.time}{" "}
              <span
                className={`rounded px-1 py-0.5 font-medium ${
                  a.format === "Online" ? "bg-teal-100 text-teal-900" : "bg-slate-100 text-slate-800"
                }`}
              >
                {a.format === "Online" ? "Online" : "Presencial"}
              </span>
              {pending && (
                <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                  Pendente
                </span>
              )}
              {a.pagamentoPendente && (
                <span className="ml-2 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-900">
                  Pagamento pendente
                </span>
              )}
              {done && (
                <span className="ml-2 rounded-full bg-emerald-200 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-900">
                  Realizada
                </span>
              )}
              {cancelled && (
                <span className="ml-2 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                  Cancelada
                </span>
              )}
            </p>
          </div>
        </div>
      </li>
    );
  }

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
          Visualize sua agenda por dia, semana ou mês. Para{" "}
          <strong className="font-semibold text-slate-800">bloquear horários</strong> e{" "}
          <strong className="font-semibold text-slate-800">configurar sua agenda</strong>, use{" "}
          <Link href="/psicologo/disponibilidade" className="font-semibold text-emerald-800 underline">
            Abrir agenda
          </Link>
          .
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/psicologo/disponibilidade"
            className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
          >
            Bloquear horários / abrir agenda
          </Link>
        </div>
      </section>
      {loadError ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{loadError}</section>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        {(["dia", "semana", "mes"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setView(m)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              view === m ? "bg-emerald-600 text-white" : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            {m === "dia" ? "Dia" : m === "semana" ? "Semana" : "Mês"}
          </button>
        ))}
      </div>

      {view === "dia" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-emerald-900">Dia</h2>
            <input
              type="date"
              value={dayCursor}
              onChange={(e) => setDayCursor(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">{formatIsoDateLong(dayCursor)}</p>
          <ul className="mt-4 space-y-2">{listForDay.map((a) => renderSessionCard(a))}</ul>
          {listForDay.length === 0 && <p className="mt-4 text-sm text-slate-500">Nenhuma sessão neste dia.</p>}
        </section>
      )}

      {view === "semana" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-emerald-900">Semana</h2>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold hover:bg-slate-50"
                onClick={() => {
                  const prev = addDays(parseIsoToLocal(weekStart), -7);
                  setWeekStart(toIso(startOfWeekMonday(prev)));
                }}
              >
                ← Anterior
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold hover:bg-slate-50"
                onClick={() => {
                  const next = addDays(parseIsoToLocal(weekStart), 7);
                  setWeekStart(toIso(startOfWeekMonday(next)));
                }}
              >
                Próxima →
              </button>
            </div>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-7">
            {weekDays.map((d) => {
              const iso = toIso(d);
              const list = weekAppointmentsByDay.get(iso) ?? [];
              return (
                <div key={iso} className="min-h-[120px] rounded-xl border border-slate-100 bg-slate-50/50 p-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {d.toLocaleDateString("pt-BR", { weekday: "short" })}
                  </p>
                  <p className="text-sm font-medium text-slate-900">{d.getDate()}</p>
                  <ul className="mt-2 space-y-1">
                    {list.map((a) => (
                      <li key={a.id} className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px]">
                        <span className="font-medium text-slate-900">{a.time}</span>{" "}
                        <span className="text-slate-700">{a.patientName.split(" ")[0]}</span>
                        <span
                          className={`ml-1 rounded px-0.5 ${a.format === "Online" ? "text-teal-700" : "text-slate-600"}`}
                        >
                          · {a.format === "Online" ? "on" : "pres"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Semana de {formatIsoDatePt(weekStart)}. Use a visualização <strong>Dia</strong> para ações em cada sessão.
          </p>
        </section>
      )}

      {view === "mes" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-emerald-900">Mês</h2>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold hover:bg-slate-50"
                onClick={() => setMonthCursor(new Date(monthYear, monthIndex - 1, 1))}
              >
                ← Mês anterior
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold hover:bg-slate-50"
                onClick={() => setMonthCursor(new Date(monthYear, monthIndex + 1, 1))}
              >
                Próximo mês →
              </button>
            </div>
          </div>
          <p className="mt-2 capitalize text-sm font-medium text-slate-800">{monthLabel(monthCursor)}</p>
          {monthAppointments.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">Nenhuma sessão neste mês nos dados de demonstração.</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {[...monthGrouped.keys()]
                .sort()
                .map((iso) => (
                  <li key={iso}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{formatIsoDateLong(iso)}</p>
                    <ul className="mt-2 space-y-2">{monthGrouped.get(iso)!.map((a) => renderSessionCard(a, true))}</ul>
                  </li>
                ))}
            </ul>
          )}
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-amber-900">Pendentes de confirmação</h2>
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
              {appointments.filter((a) => a.status === "pendente").length}
            </span>
          </div>
          {appointments.filter((a) => a.status === "pendente").length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">Nenhuma solicitação pendente.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {sortAppointments(appointments.filter((a) => a.status === "pendente")).map((a) => renderSessionCard(a))}
            </ul>
          )}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-800">Horários bloqueados</h2>
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
      </section>
    </div>
  );
}
