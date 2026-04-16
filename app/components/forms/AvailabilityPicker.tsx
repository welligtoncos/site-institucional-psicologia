"use client";

import { appointmentAvailability } from "@/app/lib/mock/appointment-availability";

type AvailabilityPickerProps = {
  selectedDate: string;
  selectedTime: string;
  onSelectDate: (value: string) => void;
  onSelectTime: (value: string) => void;
  error?: string;
};

function slotClass(status: "available" | "limited" | "unavailable", selected: boolean) {
  if (status === "unavailable") {
    return "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400";
  }

  if (selected) {
    return "border-sky-500 bg-sky-50 text-sky-800 ring-2 ring-sky-200";
  }

  if (status === "limited") {
    return "border-amber-300 bg-amber-50 text-amber-800 hover:border-amber-400";
  }

  return "border-emerald-300 bg-emerald-50 text-emerald-800 hover:border-emerald-400";
}

export function AvailabilityPicker({
  selectedDate,
  selectedTime,
  onSelectDate,
  onSelectTime,
  error,
}: AvailabilityPickerProps) {
  const selectedDay =
    appointmentAvailability.find((day) => day.date === selectedDate) ?? appointmentAvailability[0];
  const selectedSlot = selectedDay.slots.find((slot) => slot.time === selectedTime);
  const availableSlotsCount = selectedDay.slots.filter((slot) => slot.status !== "unavailable").length;

  return (
    <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Disponibilidade de horarios</h3>
          <p className="mt-1 text-xs text-slate-500">
            Escolha uma data e depois selecione o horario da sua preferencia.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-1 text-emerald-800">
            Disponivel
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-slate-500">
            Indisponivel
          </span>
        </div>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          Passo 1 · selecione a data
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {appointmentAvailability.map((day) => {
            const isSelected = day.date === selectedDay.date;
            const dayAvailable = day.slots.filter((slot) => slot.status !== "unavailable").length;

            return (
              <button
                key={day.date}
                type="button"
                onClick={() => {
                  onSelectDate(day.date);
                  const firstAvailable = day.slots.find((slot) => slot.status !== "unavailable");
                  onSelectTime(firstAvailable?.time ?? "");
                }}
                className={`rounded-xl border px-3 py-3 text-left text-sm font-medium transition ${
                  isSelected
                    ? "border-sky-500 bg-sky-50 text-sky-800"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                <p>{day.label}</p>
                <p className="mt-1 text-xs opacity-80">{dayAvailable} horarios disponiveis</p>
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
          <p className="text-xs text-slate-500">{availableSlotsCount} opcoes para {selectedDay.label}</p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {selectedDay.slots.map((slot) => {
            const isSelected = selectedTime === slot.time;
            const disabled = slot.status === "unavailable";
            const label =
              slot.status === "unavailable"
                  ? `${slot.time} · indisponivel`
                  : `${slot.time} · disponivel`;

            return (
              <button
                key={slot.time}
                type="button"
                disabled={disabled}
                onClick={() => onSelectTime(slot.time)}
                className={`rounded-xl border px-3 py-3 text-left text-sm font-medium transition ${slotClass(slot.status, isSelected)}`}
              >
                {label}
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
