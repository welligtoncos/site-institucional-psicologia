"use client";

import { ptBR } from "date-fns/locale/pt-BR";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";

import type { EquipeAgendaDay } from "@/app/lib/equipe-types";
import { agendaDayTitle, calendarDateKey, parseLocalDate } from "@/app/lib/equipe-format";

import "react-day-picker/style.css";

type EquipeAvailabilityCalendarProps = {
  agendaDays: EquipeAgendaDay[];
};

export function EquipeAvailabilityCalendar({ agendaDays }: EquipeAvailabilityCalendarProps) {
  const [selected, setSelected] = useState<Date | undefined>(undefined);

  const bookableKeys = useMemo(() => new Set(agendaDays.map((d) => d.date)), [agendaDays]);

  const bookableDates = useMemo(() => agendaDays.map((d) => parseLocalDate(d.date)), [agendaDays]);

  const defaultMonth = useMemo(() => {
    if (agendaDays.length === 0) return new Date();
    return parseLocalDate(agendaDays[0].date);
  }, [agendaDays]);

  const selectedOrFirstDate = useMemo(() => {
    if (selected) return selected;
    if (agendaDays.length === 0) return undefined;
    return parseLocalDate(agendaDays[0].date);
  }, [agendaDays, selected]);

  const selectedDay = useMemo(() => {
    if (!selectedOrFirstDate) return undefined;
    const key = calendarDateKey(selectedOrFirstDate);
    return agendaDays.find((d) => d.date === key);
  }, [agendaDays, selectedOrFirstDate]);

  if (agendaDays.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        Sem vagas no periodo exibido. Abra o portal para outras datas ou avise a recepcao.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-8">
      <div
        className="equipe-rdp mx-auto w-fit max-w-full rounded-2xl border border-emerald-100 bg-white p-2 shadow-sm sm:p-3"
        style={
          {
            "--rdp-accent-color": "rgb(2 132 199)",
            "--rdp-accent-background-color": "rgb(224 242 254)",
            "--rdp-day_button-border-radius": "0.75rem",
          } as CSSProperties
        }
      >
        <DayPicker
          mode="single"
          locale={ptBR}
          weekStartsOn={1}
          selected={selectedOrFirstDate}
          onSelect={setSelected}
          defaultMonth={defaultMonth}
          disabled={(date) => !bookableKeys.has(calendarDateKey(date))}
          modifiers={{
            bookable: bookableDates,
          }}
          modifiersClassNames={{
            bookable: "rdp-day--bookable",
          }}
          footer={
            selectedDay
              ? `${agendaDayTitle(selectedDay)} — ${selectedDay.slots.length} horario(s) disponivel(is).`
              : "Sem data selecionada."
          }
        />
      </div>

      <div className="min-h-[120px] flex-1 rounded-2xl border border-emerald-100/80 bg-white/90 p-4 shadow-sm">
        {!selectedDay ? (
          <p className="text-sm text-slate-600">
            Clique em um dia com vaga no calendario para listar os horarios livres desse dia.
          </p>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900">
              {agendaDayTitle(selectedDay)}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedDay.slots.map((slot) => (
                <span
                  key={slot}
                  className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-semibold tabular-nums text-emerald-900"
                >
                  {slot}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
