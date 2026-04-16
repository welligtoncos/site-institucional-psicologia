"use client";

import { useEffect, useMemo, useState } from "react";
import type { AppointmentAvailabilityDay, AppointmentSlotStatus } from "@/app/lib/availability";

type AvailabilityApiResponse = {
  availability: AppointmentAvailabilityDay[];
  message?: string;
};

const DEFAULT_DAYS = 21;
const STORAGE_KEY = "clinic_admin_token";

function slotButtonClass(status: AppointmentSlotStatus) {
  if (status === "unavailable") {
    return "border-rose-300 bg-rose-50 text-rose-700 hover:border-rose-400";
  }
  return "border-emerald-300 bg-emerald-50 text-emerald-800 hover:border-emerald-400";
}

export function AvailabilityAdminPanel() {
  const [token, setToken] = useState("");
  const [availability, setAvailability] = useState<AppointmentAvailabilityDay[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const selectedDay = useMemo(
    () => availability.find((item) => item.date === selectedDate) ?? availability[0],
    [availability, selectedDate],
  );

  useEffect(() => {
    const storedToken = window.localStorage.getItem(STORAGE_KEY);
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  async function loadAvailability(currentToken: string) {
    setLoading(true);
    setErrorMessage("");
    setStatusMessage("");

    try {
      const response = await fetch(`/api/admin/availability?days=${DEFAULT_DAYS}`, {
        headers: {
          "x-admin-token": currentToken,
        },
      });

      const data = (await response.json()) as AvailabilityApiResponse;

      if (!response.ok) {
        throw new Error(data.message || "Falha ao carregar disponibilidade.");
      }

      setAvailability(data.availability);
      setSelectedDate((prev) => prev || data.availability[0]?.date || "");
      setStatusMessage("Disponibilidade carregada com sucesso.");
      window.localStorage.setItem(STORAGE_KEY, currentToken);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Nao foi possivel carregar os dados.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleSlot(date: string, time: string, currentStatus: AppointmentSlotStatus) {
    if (!token) {
      setErrorMessage("Informe o token admin para alterar os horarios.");
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setStatusMessage("");

    const nextStatus: AppointmentSlotStatus = currentStatus === "available" ? "unavailable" : "available";

    try {
      const response = await fetch("/api/admin/availability", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": token,
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

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Autenticacao admin</h2>
        <p className="mt-1 text-sm text-slate-600">
          Informe o token (`ADMIN_API_TOKEN`) para carregar e gerenciar os horarios.
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            placeholder="Digite o token admin"
          />
          <button
            type="button"
            onClick={() => loadAvailability(token)}
            disabled={!token || loading}
            className="inline-flex items-center justify-center rounded-full bg-sky-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Carregando..." : "Conectar"}
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

      {availability.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">Gerenciar disponibilidade</h2>
          <p className="mt-1 text-sm text-slate-600">
            Por padrao todos os horarios ficam indisponiveis. Clique para marcar como disponivel ou
            desmarcar.
          </p>

          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {availability.map((day) => {
              const isSelected = day.date === selectedDay?.date;
              const availableCount = day.slots.filter((slot) => slot.status === "available").length;

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
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">Horarios de {selectedDay.label}</p>
                <p className="text-xs text-slate-500">{saving ? "Salvando..." : "Clique para editar"}</p>
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
                    {slot.time} · {slot.status === "available" ? "disponivel" : "indisponivel"}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
