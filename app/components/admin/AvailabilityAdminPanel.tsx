"use client";

import { useEffect, useMemo, useState } from "react";
import type { AppointmentAvailabilityDay, AppointmentSlotStatus } from "@/app/lib/availability";
import { getPortalAccessToken } from "@/app/lib/admin-api";

type AvailabilityApiResponse = {
  availability: AppointmentAvailabilityDay[];
  message?: string;
};

const DEFAULT_DAYS = 7;

function slotButtonClass(status: AppointmentSlotStatus) {
  if (status === "unavailable") {
    return "border-slate-300 bg-white text-slate-700 hover:border-slate-400";
  }
  return "border-emerald-300 bg-emerald-50 text-emerald-900 hover:border-emerald-400";
}

export function AvailabilityAdminPanel() {
  const [availability, setAvailability] = useState<AppointmentAvailabilityDay[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const manageableDays = useMemo(
    () =>
      availability
        .map((day) => ({
          ...day,
          slots: day.slots.filter((slot) => slot.status === "available"),
        }))
        .filter((day) => day.slots.length > 0),
    [availability],
  );

  const selectedDay = useMemo(
    () => manageableDays.find((item) => item.date === selectedDate) ?? manageableDays[0],
    [manageableDays, selectedDate],
  );

  useEffect(() => {
    loadAvailability();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  async function loadAvailability() {
    setLoading(true);
    setErrorMessage("");
    setStatusMessage("");

    try {
      const accessToken = getPortalAccessToken();
      if (!accessToken) {
        throw new Error("Sessao administrativa expirada. Entre novamente.");
      }
      const response = await fetch(`/api/admin/availability?days=${DEFAULT_DAYS}`, {
        headers: {
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      });

      const data = (await response.json()) as AvailabilityApiResponse;

      if (!response.ok) {
        throw new Error(data.message || "Falha ao carregar disponibilidade.");
      }

      setAvailability(data.availability);
      const nextFirstAvailable = data.availability.find((day) =>
        day.slots.some((slot) => slot.status === "available"),
      );
      setSelectedDate((prev) => prev || nextFirstAvailable?.date || "");
      setStatusMessage("Disponibilidade carregada com sucesso.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Nao foi possivel carregar os dados.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleSlot(date: string, time: string, currentStatus: AppointmentSlotStatus) {
    setSaving(true);
    setErrorMessage("");
    setStatusMessage("");

    const nextStatus: AppointmentSlotStatus = currentStatus === "available" ? "unavailable" : "available";

    try {
      const accessToken = getPortalAccessToken();
      if (!accessToken) {
        throw new Error("Sessao administrativa expirada. Entre novamente.");
      }
      const response = await fetch("/api/admin/availability", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          date,
          time,
          status: nextStatus,
        }),
      });

      const data = (await response.json()) as AvailabilityApiResponse;

      if (!response.ok) {
        throw new Error(data.message || "Falha ao atualizar horario.");
      }

      setAvailability(data.availability);
      setStatusMessage("Horario atualizado com sucesso.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Nao foi possivel atualizar horario.");
    } finally {
      setSaving(false);
    }
  }

  async function setAllSlotsForDay(day: AppointmentAvailabilityDay, status: AppointmentSlotStatus) {
    setSaving(true);
    setErrorMessage("");
    setStatusMessage("");
    try {
      const accessToken = getPortalAccessToken();
      if (!accessToken) {
        throw new Error("Sessao administrativa expirada. Entre novamente.");
      }
      for (const slot of day.slots) {
        if (slot.status === status) continue;
        const response = await fetch("/api/admin/availability", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({
            date: day.date,
            time: slot.time,
            status,
          }),
        });
        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as { message?: string };
          throw new Error(data.message || "Falha ao atualizar horarios em lote.");
        }
      }
      await loadAvailability();
      setStatusMessage(
        status === "available"
          ? "Todos os horários do dia foram liberados."
          : "Todos os horários do dia foram bloqueados.",
      );
    } catch {
      setErrorMessage("Nao foi possivel atualizar todos os horarios.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">
          Disponibilidade
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Exibindo os próximos 7 dias com horários já disponibilizados pelo psicólogo.
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => loadAvailability()}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-full bg-sky-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Carregando..." : "Atualizar disponibilidade"}
          </button>
        </div>

        {statusMessage ? (
          <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {statusMessage}
          </p>
        ) : null}
        {errorMessage ? (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {errorMessage}
          </p>
        ) : null}
      </section>

      {manageableDays.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">Gerenciar disponibilidade</h2>
          <p className="mt-1 text-sm text-slate-600">
            Apenas horários disponíveis aparecem aqui. Clique no horário para bloquear.
          </p>

          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {manageableDays.map((day) => {
              const isSelected = day.date === selectedDay?.date;
              const availableCount = day.slots.length;

              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => setSelectedDate(day.date)}
                  className={`rounded-xl border px-3 py-3 text-left transition ${
                    isSelected
                      ? "border-sky-500 bg-sky-50 text-sky-800"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <p className="text-sm font-medium">{day.label}</p>
                  <p className="mt-1 text-xs opacity-80">{availableCount} horarios disponiveis</p>
                </button>
              );
            })}
          </div>

          {selectedDay ? (
            <div className="mt-6">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">Horarios de {selectedDay.label}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setAllSlotsForDay(selectedDay, "unavailable")}
                    className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                  >
                    Bloquear todos do dia
                  </button>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {selectedDay.slots.map((slot) => (
                  <button
                    key={slot.time}
                    type="button"
                    onClick={() => toggleSlot(selectedDay.date, slot.time, slot.status)}
                    disabled={saving}
                    className={`rounded-xl border px-3 py-3 text-left text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${slotButtonClass(slot.status)}`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{slot.time}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${slot.status === "available" ? "bg-emerald-100 text-emerald-900" : "bg-slate-200 text-slate-700"}`}>
                        {slot.status === "available" ? "Disponível" : "Bloqueado"}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
      {manageableDays.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-sm text-slate-600">
            Nenhum horário disponível encontrado nos próximos 7 dias para este psicólogo.
          </p>
        </section>
      ) : null}
    </div>
  );
}
