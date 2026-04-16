"use client";

import type { AppointmentAvailabilityDay } from "@/app/lib/availability";

type AvailabilityPickerProps = {
  /** Dias com pelo menos um horario liberado; slots ja filtrados para apenas `available`. */
  availability: AppointmentAvailabilityDay[];
  selectedDate: string;
  selectedTime: string;
  onSelectDate: (value: string) => void;
  onSelectTime: (value: string) => void;
  error?: string;
};

function slotClass(selected: boolean) {
  if (selected) {
    return "border-sky-500 bg-sky-50 text-sky-800 ring-2 ring-sky-200";
  }

  return "border-emerald-300 bg-emerald-50 text-emerald-800 hover:border-emerald-400";
}

export function AvailabilityPicker({
  availability,
  selectedDate,
  selectedTime,
  onSelectDate,
  onSelectTime,
  error,
}: AvailabilityPickerProps) {
  const selectedDay = availability.find((day) => day.date === selectedDate) ?? availability[0];

  if (!selectedDay) {
    return (
      <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
        <p className="text-sm font-medium text-slate-800">Nenhum horario liberado no momento</p>
        <p className="mt-1 text-xs text-slate-600">
          Assim que a clinica publicar novas vagas, elas aparecerao aqui automaticamente.
        </p>
      </div>
    );
  }

  const selectedSlot = selectedDay.slots.find((slot) => slot.time === selectedTime);
  const availableSlotsCount = selectedDay.slots.length;

  return (
    <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Disponibilidade de horarios</h3>
          <p className="mt-1 text-xs text-slate-500">
            Mostramos apenas datas e horarios liberados pela clinica. Escolha o dia e depois o horario.
          </p>
        </div>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          Passo 1 · selecione a data
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {availability.map((day) => {
            const isSelected = day.date === selectedDay.date;
            const dayAvailable = day.slots.length;

            return (
              <button
                key={day.date}
                type="button"
                onClick={() => {
                  onSelectDate(day.date);
                  onSelectTime(day.slots[0]?.time ?? "");
                }}
                className={`rounded-xl border px-3 py-3 text-left text-sm font-medium transition ${
                  isSelected
                    ? "border-sky-500 bg-sky-50 text-sky-800"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                <p>{day.label}</p>
                <p className="mt-1 text-xs opacity-80">
                  {dayAvailable} {dayAvailable === 1 ? "horario disponivel" : "horarios disponiveis"}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Passo 2 · selecione o horario
          </p>
          <p className="text-xs text-slate-500">
            {availableSlotsCount} {availableSlotsCount === 1 ? "opcao para" : "opcoes para"}{" "}
            {selectedDay.label}
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {selectedDay.slots.map((slot) => {
            const isSelected = selectedTime === slot.time;

            return (
              <button
                key={slot.time}
                type="button"
                onClick={() => onSelectTime(slot.time)}
                className={`rounded-xl border px-3 py-3 text-left text-sm font-medium transition ${slotClass(isSelected)}`}
              >
                {slot.time}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
        {selectedSlot ? (
          <p>
            Horario selecionado:{" "}
            <span className="font-semibold text-slate-900">
              {selectedDay.label} as {selectedSlot.time}
            </span>
          </p>
        ) : (
          <p>Nenhum horario selecionado. Escolha uma opcao para continuar.</p>
        )}
      </div>

      {error ? <p className="mt-3 text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
