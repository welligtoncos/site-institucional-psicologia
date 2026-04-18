"use client";

import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

import {
  ALL_SPECIALTY_LABELS,
  MOCK_PSYCHOLOGISTS,
  filterPsychologists,
  mockSlotsForDate,
  nextDates,
  type MockPsychologist,
} from "@/app/lib/portal-mocks";

const MAX_PRICE = 300;

function formatDateLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
}

export function ScheduleConsultationBoard() {
  const searchParams = useSearchParams();
  const prePsych = searchParams.get("psych");

  const [specialty, setSpecialty] = useState("todas");
  const [maxPrice, setMaxPrice] = useState(MAX_PRICE);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "card" | "boleto">("pix");
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "processing" | "approved">("idle");
  const [confirmed, setConfirmed] = useState(false);

  const dateOptions = useMemo(() => nextDates(new Date(), 7), []);

  useEffect(() => {
    if (prePsych && MOCK_PSYCHOLOGISTS.some((p) => p.id === prePsych)) {
      setSelectedId(prePsych);
    }
  }, [prePsych]);

  useEffect(() => {
    if (!selectedDate && dateOptions.length > 0) {
      setSelectedDate(dateOptions[0]!);
    }
  }, [dateOptions, selectedDate]);

  const filtered = useMemo(
    () =>
      filterPsychologists({
        specialty: specialty === "todas" ? "todas" : specialty,
        maxPrice,
        onlyAvailable,
      }),
    [specialty, maxPrice, onlyAvailable],
  );

  /** Só considera selecionado quem ainda aparece na lista filtrada (evita select “mudar” e agenda ficar no profissional errado). */
  const selected: MockPsychologist | null = selectedId
    ? (filtered.find((p) => p.id === selectedId) ?? null)
    : null;

  const slotsForDay = useMemo(() => {
    if (!selected || !selectedDate) return [];
    return mockSlotsForDate(selected.id, selectedDate);
  }, [selected, selectedDate]);

  function handleSelectPsych(id: string) {
    setSelectedId(id);
    setSelectedTime("");
    setConfirmed(false);
    setPaymentStatus("idle");
  }

  function handleConfirm() {
    if (!selected || !selectedDate || !selectedTime) return;
    setPaymentStatus("processing");
    window.setTimeout(() => {
      setPaymentStatus("approved");
      setConfirmed(true);
    }, 900);
  }

  const specialtyOptions = ["todas", ...ALL_SPECIALTY_LABELS];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-sky-100 bg-gradient-to-r from-sky-50 to-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Agenda</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Agendar consulta</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
          Filtre por especialidade, preço e disponibilidade; escolha o profissional, a data e o horário. Fluxo mockado —
          nenhum dado é enviado ao servidor.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">Filtros da agenda</p>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-start">
          <label className="flex min-w-[200px] max-w-full flex-1 flex-col gap-1.5">
            <span className="text-xs font-medium text-slate-500">Especialidade</span>
            <select
              name="portal-specialty"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              className="block w-full min-h-11 appearance-auto rounded-xl border border-slate-300 bg-white px-3 py-2.5 pr-10 text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200/90"
            >
              {specialtyOptions.map((s) => (
                <option key={s} value={s}>
                  {s === "todas" ? "Todas" : s}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[220px] flex-1 flex-col gap-1.5">
            <span className="text-xs font-medium text-slate-500">Preço máximo (R$ {maxPrice})</span>
            <input
              type="range"
              min={150}
              max={MAX_PRICE}
              step={10}
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
              className="w-full accent-sky-600"
            />
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
            <input
              type="checkbox"
              checked={onlyAvailable}
              onChange={(e) => setOnlyAvailable(e.target.checked)}
              className="rounded border-slate-300 text-sky-600"
            />
            <span className="text-sm text-slate-700">Só com disponibilidade (mock)</span>
          </label>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">1. Profissional</p>
          <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {filtered.map((p) => {
              const active = p.id === selectedId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPsych(p.id)}
                  className={`flex w-full gap-3 rounded-xl border p-3 text-left transition ${
                    active ? "border-sky-400 bg-sky-50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${p.avatarClass} text-xs font-bold text-white`}
                  >
                    {p.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-600">{p.primarySpecialty}</p>
                    <p className="mt-1 text-xs font-semibold text-sky-700">
                      R$ {p.price.toFixed(2).replace(".", ",")}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
          {filtered.length === 0 ? (
            <p className="mt-3 text-sm text-amber-800">Nenhum profissional com esses filtros.</p>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">2. Data</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {dateOptions.map((iso) => {
                const on = iso === selectedDate;
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => {
                      setSelectedDate(iso);
                      setSelectedTime("");
                      setConfirmed(false);
                    }}
                    disabled={!selected}
                    className={`rounded-xl border px-3 py-2 text-left text-xs transition ${
                      on ? "border-sky-400 bg-sky-50 font-semibold text-sky-900" : "border-slate-200 text-slate-700"
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {formatDateLabel(iso)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">3. Horário disponível</p>
            {!selected ? (
              <p className="mt-3 text-sm text-slate-500">Selecione um profissional.</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {slotsForDay.map((t) => {
                  const on = t === selectedTime;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setSelectedTime(t);
                        setConfirmed(false);
                        setPaymentStatus("idle");
                      }}
                      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                        on ? "border-sky-400 bg-sky-50 text-sky-900" : "border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            )}
            {selected && slotsForDay.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Sem horários mock para esta data.</p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">4. Pagamento (mock)</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {[
                { id: "pix" as const, label: "PIX" },
                { id: "card" as const, label: "Cartão" },
                { id: "boleto" as const, label: "Boleto" },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setPaymentMethod(m.id);
                    setConfirmed(false);
                    setPaymentStatus("idle");
                  }}
                  className={`rounded-xl border px-3 py-2 text-sm font-medium ${
                    paymentMethod === m.id
                      ? "border-sky-400 bg-sky-50 text-sky-900"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!selected || !selectedDate || !selectedTime || paymentStatus === "processing"}
              className="mt-5 w-full rounded-full bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {paymentStatus === "processing" ? "Confirmando…" : "Confirmar agendamento"}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">Resumo</p>
        {selected && selectedDate && selectedTime ? (
          <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
            <li>
              <span className="font-semibold text-slate-900">Profissional:</span> {selected.name}
            </li>
            <li>
              <span className="font-semibold text-slate-900">Data:</span> {formatDateLabel(selectedDate)} ({selectedDate})
            </li>
            <li>
              <span className="font-semibold text-slate-900">Horário:</span> {selectedTime}
            </li>
            <li>
              <span className="font-semibold text-slate-900">Valor:</span> R${" "}
              {selected.price.toFixed(2).replace(".", ",")}
            </li>
            <li>
              <span className="font-semibold text-slate-900">Pagamento:</span>{" "}
              {paymentMethod === "pix" ? "PIX" : paymentMethod === "card" ? "Cartão" : "Boleto"}
            </li>
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-500">Preencha profissional, data e horário.</p>
        )}
        {paymentStatus === "approved" ? (
          <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
            Consulta criada com sucesso (mock). Em produção, você receberia confirmação por e-mail e veria na lista de
            consultas.
          </p>
        ) : null}
        {confirmed ? (
          <p className="mt-2 text-xs text-slate-500">
            Dica: o profissional pré-selecionado vindo da lista de psicólogos usa o parâmetro{" "}
            <code className="rounded bg-slate-100 px-1">?psych=</code> na URL.
          </p>
        ) : null}
      </section>
    </div>
  );
}
