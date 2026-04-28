"use client";

import { ptBR } from "date-fns/locale/pt-BR";
import Link from "next/link";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";

import {
  formatIsoDateLong,
  formatIsoDatePt,
  todayIso,
  WEEKDAY_LONG,
  WEEKDAY_ORDER,
  type DaySlot,
  type PsychologistAgendaAppointment,
  type TimeBlock,
} from "@/app/lib/psicologo-mocks";
import {
  apiAgendaToMock,
  fetchPsychologistAgenda,
} from "@/app/lib/psychologist-agenda-api";
import { apiToMock, fetchPsychologistAvailability } from "@/app/lib/psychologist-availability-api";

import "react-day-picker/style.css";

type MainView = "calendario" | "semana";

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

function startOfToday(): Date {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
}

function hhmmNowLocal(): string {
  const n = new Date();
  const hh = String(n.getHours()).padStart(2, "0");
  const mm = String(n.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function PsychologistAgendaView() {
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [appointments, setAppointments] = useState<PsychologistAgendaAppointment[]>([]);
  const [openWeekly, setOpenWeekly] = useState<DaySlot[]>([]);
  const [openAgendaError, setOpenAgendaError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [hydrated, setHydrated] = useState(false);

  const [mainView, setMainView] = useState<MainView>("calendario");
  const [selectedDay, setSelectedDay] = useState<Date>(() => startOfToday());
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });
  const [weekStart, setWeekStart] = useState(() => toIso(startOfWeekMonday(new Date())));

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

  const refreshOpenAgenda = useCallback(async () => {
    const result = await fetchPsychologistAvailability();
    if (result.ok && "weekly" in result.data && Array.isArray(result.data.weekly)) {
      const mapped = apiToMock(result.data);
      const weeklyOpen = mapped.weekly
        .filter((row) => row.enabled)
        .sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start));
      setOpenWeekly(weeklyOpen);
      setOpenAgendaError("");
      return;
    }
    setOpenWeekly([]);
    setOpenAgendaError("Não foi possível carregar a disponibilidade aberta pela API.");
  }, []);

  useEffect(() => {
    const onAvailabilityChanged = () => {
      void refreshAgenda();
      void refreshOpenAgenda();
    };
    void refreshAgenda();
    void refreshOpenAgenda();
    setHydrated(true);
    window.addEventListener("psychologist-availability-changed", onAvailabilityChanged);
    window.addEventListener("storage", onAvailabilityChanged);
    window.addEventListener("psychologist-agenda-changed", onAvailabilityChanged);
    return () => {
      window.removeEventListener("psychologist-availability-changed", onAvailabilityChanged);
      window.removeEventListener("storage", onAvailabilityChanged);
      window.removeEventListener("psychologist-agenda-changed", onAvailabilityChanged);
    };
  }, [refreshAgenda, refreshOpenAgenda]);

  const t = todayIso();
  const nowHHMM = useMemo(() => hhmmNowLocal(), []);
  const blockedFuture = useMemo(() => {
    return blocks.filter((b) => b.isoDate >= t).sort((a, b) => a.isoDate.localeCompare(b.isoDate));
  }, [blocks, t]);

  const selectedIso = useMemo(() => toIso(selectedDay), [selectedDay]);
  const selectedWeekday = useMemo(() => selectedDay.getDay() as keyof typeof WEEKDAY_LONG, [selectedDay]);

  const listForSelectedDay = useMemo(() => {
    return sortAppointments(appointments.filter((a) => a.isoDate === selectedIso));
  }, [appointments, selectedIso]);

  const appointmentDayDates = useMemo(
    () => [...new Set(appointments.map((a) => a.isoDate))].map((iso) => parseIsoToLocal(iso)),
    [appointments],
  );

  const blockDayDates = useMemo(
    () => [...new Set(blockedFuture.map((b) => b.isoDate))].map((iso) => parseIsoToLocal(iso)),
    [blockedFuture],
  );

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

  const openWeeklyByDay = useMemo(() => {
    const map = new Map<number, DaySlot[]>();
    for (const d of WEEKDAY_ORDER) {
      map.set(d, []);
    }
    for (const row of openWeekly) {
      map.get(row.weekday)?.push(row);
    }
    for (const d of WEEKDAY_ORDER) {
      const rows = map.get(d) ?? [];
      rows.sort((a, b) => a.start.localeCompare(b.start));
      map.set(d, rows);
    }
    return map;
  }, [openWeekly]);
  const openRowsForSelectedDay = useMemo(
    () => (openWeeklyByDay.get(selectedWeekday) ?? []).sort((a, b) => a.start.localeCompare(b.start)),
    [openWeeklyByDay, selectedWeekday],
  );
  const visibleOpenRowsForSelectedDay = useMemo(() => {
    if (selectedIso < t) return [];
    if (selectedIso > t) return openRowsForSelectedDay;
    return openRowsForSelectedDay.filter((row) => row.end > nowHHMM);
  }, [nowHHMM, openRowsForSelectedDay, selectedIso, t]);
  const isDateClosedForOpenAgenda = useCallback(
    (date: Date) => {
      const iso = toIso(date);
      if (iso < t) return true;
      const rows = (openWeeklyByDay.get(date.getDay()) ?? []).sort((a, b) => a.start.localeCompare(b.start));
      if (rows.length === 0) return true;
      if (iso > t) return false;
      return rows.every((row) => row.end <= nowHHMM);
    },
    [nowHHMM, openWeeklyByDay, t],
  );

  function goToWeekContainingSelected() {
    setWeekStart(toIso(startOfWeekMonday(selectedDay)));
    setMainView("semana");
  }

  function renderSessionCard(a: PsychologistAgendaAppointment) {
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

  const calendarFooter =
    listForSelectedDay.length === 0
      ? `${formatIsoDateLong(selectedIso)} — nenhuma sessão neste dia.`
      : `${formatIsoDateLong(selectedIso)} — ${listForSelectedDay.length} sessão(ões) neste dia.`;

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
          Use o <strong className="font-semibold text-slate-800">calendário</strong> para saltar entre dias: dias com
          consulta ou bloqueio aparecem marcados. Abaixo, veja o detalhe do dia selecionado. Para{" "}
          <strong className="font-semibold text-slate-800">bloquear horários</strong>, use{" "}
          <Link href="/psicologo/disponibilidade" className="font-semibold text-emerald-800 underline">
            Disponibilidade
          </Link>
          .
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/psicologo/disponibilidade"
            className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
          >
            Bloquear horários / configurar agenda
          </Link>
        </div>
      </section>

      {loadError ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{loadError}</section>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <button
          type="button"
          onClick={() => setMainView("calendario")}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            mainView === "calendario" ? "bg-emerald-600 text-white" : "text-slate-700 hover:bg-slate-50"
          }`}
        >
          Calendário
        </button>
        <button
          type="button"
          onClick={() => {
            goToWeekContainingSelected();
          }}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            mainView === "semana" ? "bg-emerald-600 text-white" : "text-slate-700 hover:bg-slate-50"
          }`}
        >
          Semana
        </button>
        <button
          type="button"
          onClick={() => {
            const n = startOfToday();
            setSelectedDay(n);
            setCalendarMonth(new Date(n.getFullYear(), n.getMonth(), 1));
            setMainView("calendario");
          }}
          className="ml-auto rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Hoje
        </button>
      </div>

      {mainView === "calendario" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
            <div className="mx-auto w-fit lg:mx-0">
              <div
                className="psicologo-agenda-rdp rounded-2xl border border-emerald-100 bg-slate-50/50 p-2 sm:p-3"
                style={
                  {
                    "--rdp-accent-color": "rgb(5 150 105)",
                    "--rdp-accent-background-color": "rgb(209 250 229)",
                    "--rdp-day_button-border-radius": "0.75rem",
                  } as CSSProperties
                }
              >
                <DayPicker
                  mode="single"
                  locale={ptBR}
                  weekStartsOn={1}
                  month={calendarMonth}
                  onMonthChange={setCalendarMonth}
                  selected={selectedDay}
                  disabled={isDateClosedForOpenAgenda}
                  onSelect={(d) => {
                    if (d) {
                      setSelectedDay(d);
                      setCalendarMonth(new Date(d.getFullYear(), d.getMonth(), 1));
                    }
                  }}
                  modifiers={{
                    temConsulta: appointmentDayDates,
                    temBloqueio: blockDayDates,
                  }}
                  modifiersClassNames={{
                    temConsulta: "rdp-day--ps-agenda-appt",
                    temBloqueio: "rdp-day--ps-agenda-block",
                  }}
                  footer={calendarFooter}
                />
              </div>
              <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-slate-600">
                <li className="flex items-center gap-2">
                  <span className="h-2 w-6 rounded-sm bg-emerald-500" aria-hidden />
                  Dia com consulta
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2 w-6 rounded-sm bg-amber-400" aria-hidden />
                  Dia com bloqueio
                </li>
              </ul>
            </div>

            <div className="min-h-[200px] flex-1 rounded-2xl border border-slate-100 bg-slate-50/40 p-4">
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-900">Dia selecionado</h2>
              <p className="mt-1 text-lg font-semibold capitalize text-slate-900">{formatIsoDateLong(selectedIso)}</p>
              <div className="mt-3 rounded-xl border border-sky-100 bg-white/80 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-900">Agenda aberta</p>
                {openAgendaError ? (
                  <p className="mt-1 text-xs text-rose-700">Falha ao carregar disponibilidade aberta.</p>
                ) : visibleOpenRowsForSelectedDay.length === 0 ? (
                  <p className="mt-1 text-xs text-slate-500">Sem horários abertos disponíveis neste momento.</p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {visibleOpenRowsForSelectedDay.map((row, idx) => (
                      <span
                        key={`${selectedWeekday}-${row.start}-${row.end}-${idx}`}
                        className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-900"
                      >
                        {row.start} até {row.end}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <ul className="mt-4 space-y-2">{listForSelectedDay.map((a) => renderSessionCard(a))}</ul>
              {listForSelectedDay.length === 0 && (
                <p className="mt-4 text-sm text-slate-500">Nenhuma sessão agendada neste dia.</p>
              )}
              <button
                type="button"
                onClick={goToWeekContainingSelected}
                className="mt-6 text-xs font-semibold text-emerald-800 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-950"
              >
                Ver esta data na visão semanal →
              </button>
            </div>
          </div>
        </section>
      )}

      {mainView === "semana" && (
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
              const isSel = iso === selectedIso;
              return (
                <div
                  key={iso}
                  className={`min-h-[120px] rounded-xl border p-2 transition ${
                    isSel ? "border-emerald-400 bg-emerald-50/40 ring-1 ring-emerald-200" : "border-slate-100 bg-slate-50/50"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDay(d);
                      setCalendarMonth(new Date(d.getFullYear(), d.getMonth(), 1));
                    }}
                    className="w-full text-left"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {d.toLocaleDateString("pt-BR", { weekday: "short" })}
                    </p>
                    <p className="text-sm font-medium text-slate-900">{d.getDate()}</p>
                  </button>
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
            Semana de {formatIsoDatePt(weekStart)}. Clique em um dia para selecioná-lo; use a aba{" "}
            <strong className="font-semibold text-slate-700">Calendário</strong> para ver o detalhe das sessões.
          </p>
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
