"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  WEEKDAY_LONG,
  WEEKDAY_ORDER,
  type DaySlot,
  type PsychologistAvailabilityMock,
  type TimeBlock,
  type Weekday,
} from "@/app/lib/psicologo-mocks";
import {
  apiToMock,
  fetchPsychologistAvailability,
  mockToApiPayload,
  putPsychologistAvailability,
  type ApiPsychologistAvailability,
} from "@/app/lib/psychologist-availability-api";

const EMPTY: PsychologistAvailabilityMock = { weekly: [], blocks: [] };
const DEFAULT_SESSION_DURATION_MIN = 50;
/** Passo do campo de horário em segundos (60 = qualquer minuto: 09:00, 09:15, …). */
const TIME_INPUT_STEP_SEC = 60;
const ACCESS_TOKEN_KEY = "portal_access_token";

type PsychologistProfileDurationResponse = {
  psicologo?: {
    duracao_minutos_padrao?: number | null;
  };
};

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

function toHHMM(totalMin: number): string {
  const normalized = ((totalMin % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function sortWeeklyRows(rows: DaySlot[]): DaySlot[] {
  return [...rows].sort((a, b) => {
    const weekdayCompare = a.weekday - b.weekday;
    if (weekdayCompare !== 0) return weekdayCompare;
    return a.start.localeCompare(b.start);
  });
}

function sessionEndFromStart(start: string, durationMin: number): string {
  return toHHMM(toMinutes(start) + durationMin);
}

/** Intervalos semiabertos [a0,a1) e [b0,b1) em minutos desde meia-noite. */
function sessionRangesOverlap(startA: string, startB: string, durationMin: number): boolean {
  const a0 = toMinutes(startA);
  const a1 = a0 + durationMin;
  const b0 = toMinutes(startB);
  const b1 = b0 + durationMin;
  return !(a1 <= b0 || a0 >= b1);
}

export function PsychologistAvailabilityBoard() {
  const [data, setData] = useState<PsychologistAvailabilityMock>(EMPTY);
  const [savedData, setSavedData] = useState<PsychologistAvailabilityMock>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const [loadError, setLoadError] = useState<"forbidden" | "generic" | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [showBlocks, setShowBlocks] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sessionDurationMin, setSessionDurationMin] = useState(DEFAULT_SESSION_DURATION_MIN);
  const [newSlotByDay, setNewSlotByDay] = useState<Record<Weekday, { start: string; end: string } | null>>({
    1: null,
    2: null,
    3: null,
    4: null,
    5: null,
    6: null,
    0: null,
  });

  const [blockDate, setBlockDate] = useState("");
  const [blockAllDay, setBlockAllDay] = useState(true);
  const [blockStart, setBlockStart] = useState("12:00");
  const [blockEnd, setBlockEnd] = useState("13:00");
  const [blockNote, setBlockNote] = useState("");

  const hasUnsavedChanges = useMemo(() => {
    const current = {
      weekly: sortWeeklyRows(data.weekly),
      blocks: [...data.blocks].sort((a, b) => a.isoDate.localeCompare(b.isoDate) || a.note.localeCompare(b.note)),
    };
    const saved = {
      weekly: sortWeeklyRows(savedData.weekly),
      blocks: [...savedData.blocks].sort((a, b) => a.isoDate.localeCompare(b.isoDate) || a.note.localeCompare(b.note)),
    };
    return JSON.stringify(current) !== JSON.stringify(saved);
  }, [data, savedData]);

  useEffect(() => {
    if (saveStatus !== "saved" && saveStatus !== "error") return;
    const t = window.setTimeout(() => setSaveStatus("idle"), 2200);
    return () => window.clearTimeout(t);
  }, [saveStatus]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof window === "undefined") return;
      const token = window.localStorage.getItem(ACCESS_TOKEN_KEY);
      if (!token) return;
      const response = await fetch("/api/portal/profile/psychologist", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!response.ok) return;
      const json = (await response.json().catch(() => null)) as PsychologistProfileDurationResponse | null;
      const duration = json?.psicologo?.duracao_minutos_padrao;
      if (cancelled || !Number.isFinite(duration) || (duration ?? 0) <= 0) return;
      setSessionDurationMin(Number(duration));
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await fetchPsychologistAvailability();
      if (cancelled) return;
      if (result.ok && "weekly" in result.data) {
        const mapped = apiToMock(result.data as ApiPsychologistAvailability);
        setData(mapped);
        setSavedData(mapped);
        setLoadError(null);
      } else if (result.status === 403) {
        setLoadError("forbidden");
      } else {
        setLoadError("generic");
        const detail =
          "detail" in result.data && typeof result.data.detail === "string"
            ? result.data.detail
            : "Não foi possível carregar a disponibilidade.";
        toast.error(detail);
      }
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveAvailabilityConfirmed() {
    const duration = sessionDurationMin;
    const normalizedWeekly = data.weekly.map((row) => ({
      ...row,
      end: sessionEndFromStart(row.start, duration),
    }));

    const duplicateWeekly = normalizedWeekly.some((row, index, list) =>
      list.some((other, otherIndex) => otherIndex !== index && other.weekday === row.weekday && other.start === row.start),
    );
    if (duplicateWeekly) {
      toast.error(
        "No mesmo dia da semana não pode repetir o mesmo horário de início. Em outro dia, o mesmo horário é permitido.",
      );
      return;
    }

    for (const wd of WEEKDAY_ORDER) {
      const rows = normalizedWeekly
        .filter((r) => r.weekday === wd)
        .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
      for (let i = 0; i < rows.length; i++) {
        for (let j = i + 1; j < rows.length; j++) {
          if (sessionRangesOverlap(rows[i].start, rows[j].start, duration)) {
            toast.error(
              `Em ${WEEKDAY_LONG[wd]}, os horários de início se sobrepõem considerando sessões de ${duration} min. Afaste os inícios ou remova um intervalo.`,
            );
            return;
          }
        }
      }
    }

    const invalidBlocks = data.blocks.some(
      (b) => !b.allDay && b.startTime && b.endTime && toMinutes(b.endTime) <= toMinutes(b.startTime),
    );
    if (invalidBlocks) {
      toast.error("Existe bloqueio com horário final menor ou igual ao inicial.");
      return;
    }
    setSaveStatus("saving");
    const payload = mockToApiPayload({ ...data, weekly: normalizedWeekly });
    const result = await putPsychologistAvailability(payload);
    if (result.ok && "weekly" in result.data) {
      const mapped = apiToMock(result.data as ApiPsychologistAvailability);
      setData(mapped);
      setSavedData(mapped);
      setSaveStatus("saved");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("psychologist-availability-changed"));
      }
      toast.success("Disponibilidade confirmada e salva.");
      return;
    }
    setSaveStatus("error");
    const detail =
      "detail" in result.data && typeof result.data.detail === "string"
        ? result.data.detail
        : "Não foi possível salvar a disponibilidade.";
    toast.error(detail);
  }

  function updateWeekly(index: number, patch: Partial<DaySlot>) {
    const current = data.weekly[index];
    if (!current) return;
    const nextStart = patch.start ?? current.start;
    const hasDuplicate = data.weekly.some(
      (row, i) => i !== index && row.weekday === current.weekday && row.start === nextStart,
    );
    if (hasDuplicate) {
      toast.error(
        `Já existe esse horário neste dia (${WEEKDAY_LONG[current.weekday]}). Em outro dia da semana você pode usar o mesmo horário.`,
      );
      return;
    }
    const hasOverlap = data.weekly.some(
      (row, i) =>
        i !== index &&
        row.weekday === current.weekday &&
        sessionRangesOverlap(row.start, nextStart, sessionDurationMin),
    );
    if (hasOverlap) {
      toast.error(
        `Esse início sobrepõe outro horário em ${WEEKDAY_LONG[current.weekday]} (sessões de ${sessionDurationMin} min).`,
      );
      return;
    }
    setData((prev) => {
      const weekly = prev.weekly.map((row, i) => {
        if (i !== index) return row;
        const autoEnd = sessionEndFromStart(nextStart, sessionDurationMin);
        return { ...row, ...patch, start: nextStart, end: autoEnd, enabled: true };
      });
      return { ...prev, weekly };
    });
  }

  function removeWeekly(index: number) {
    setData((prev) => ({ ...prev, weekly: prev.weekly.filter((_, i) => i !== index) }));
  }

  function openNewSlotEditor(day: Weekday) {
    const start = "09:00";
    const end = sessionEndFromStart(start, sessionDurationMin);
    setNewSlotByDay((prev) => ({ ...prev, [day]: { start, end } }));
  }

  function cancelNewSlotEditor(day: Weekday) {
    setNewSlotByDay((prev) => ({ ...prev, [day]: null }));
  }

  function createSlotForDay(day: Weekday) {
    const draft = newSlotByDay[day];
    if (!draft) return;
    const hasDuplicate = data.weekly.some((row) => row.weekday === day && row.start === draft.start);
    if (hasDuplicate) {
      toast.error(
        `Já existe esse horário neste dia (${WEEKDAY_LONG[day]}). Em outro dia da semana você pode usar o mesmo horário.`,
      );
      return;
    }
    const hasOverlap = data.weekly.some(
      (row) => row.weekday === day && sessionRangesOverlap(row.start, draft.start, sessionDurationMin),
    );
    if (hasOverlap) {
      toast.error(`Esse início sobrepõe outro horário em ${WEEKDAY_LONG[day]} (sessões de ${sessionDurationMin} min).`);
      return;
    }
    const autoEnd = sessionEndFromStart(draft.start, sessionDurationMin);
    setData((prev) => ({
      ...prev,
      weekly: [...prev.weekly, { weekday: day, enabled: true, start: draft.start, end: autoEnd }],
    }));
    setNewSlotByDay((prev) => ({ ...prev, [day]: null }));
    toast.success(`Intervalo adicionado em ${WEEKDAY_LONG[day]}.`);
    setConfirmOpen(true);
  }

  function addBlock() {
    if (!blockDate) return;
    const b: TimeBlock = {
      id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `blk-${Date.now()}`,
      isoDate: blockDate,
      allDay: blockAllDay,
      note: blockNote.trim() || "Bloqueio",
    };
    if (!blockAllDay) {
      b.startTime = blockStart;
      b.endTime = blockEnd;
    }
    setData((prev) => ({ ...prev, blocks: [...prev.blocks, b] }));
    setBlockNote("");
    toast.success("Bloqueio adicionado.");
  }

  function removeBlock(id: string) {
    setData((prev) => ({ ...prev, blocks: prev.blocks.filter((b) => b.id !== id) }));
  }

  if (!hydrated) {
    return (
      <div className="rounded-2xl border border-emerald-100 bg-white p-8 text-center text-sm text-slate-600">
        Carregando disponibilidade…
      </div>
    );
  }

  if (loadError === "forbidden") {
    return (
      <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950 shadow-sm">
        <p className="font-medium">Disponível apenas para contas cadastradas como psicólogo.</p>
        <p className="text-amber-900/90">
          Usuários administrativos podem gerenciar outros recursos no painel; a disponibilidade semanal fica vinculada ao
          perfil profissional.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800">Abrir agenda</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">Abrir agenda: horários e bloqueios</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Defina seus horários de atendimento, publique sua agenda para os pacientes e bloqueie datas quando necessário.
            </p>
            {loadError === "generic" ? (
              <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
                Não foi possível carregar os dados salvos. Verifique se a API está no ar e tente atualizar a página.
              </p>
            ) : null}
          </div>
          <p className="text-xs font-medium text-slate-500" aria-live="polite">
            {saveStatus === "saving"
              ? "Salvando alterações..."
              : saveStatus === "saved"
                ? "Disponibilidade atualizada."
                : saveStatus === "error"
                  ? "Erro ao salvar."
                  : hasUnsavedChanges
                    ? "Você tem alterações para confirmar."
                    : "Agenda atualizada e sem alterações pendentes."}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-emerald-900">Horários por dia da semana</h2>
        <p className="mt-1 text-xs text-slate-500">
          Um horário de início por linha; o fim é calculado com a duração padrão da sessão do seu perfil.
        </p>
        <div className="mt-6 space-y-6">
          {WEEKDAY_ORDER.map((day) => {
            const indices = data.weekly
              .map((row, i) => ({ row, i }))
              .filter(({ row }) => row.weekday === day);
            return (
              <div key={day} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">{WEEKDAY_LONG[day]}</h3>
                  {newSlotByDay[day] ? null : (
                    <button
                      type="button"
                      onClick={() => openNewSlotEditor(day)}
                      className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
                    >
                      + Adicionar intervalo
                    </button>
                  )}
                </div>
                {newSlotByDay[day] ? (
                  <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
                    <p className="mb-2 text-xs font-medium text-emerald-900">Novo intervalo</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="time"
                        step={TIME_INPUT_STEP_SEC}
                        value={newSlotByDay[day]?.start ?? "09:00"}
                        onChange={(e) =>
                          setNewSlotByDay((prev) => ({
                            ...prev,
                            [day]: {
                              start: e.target.value,
                              end: sessionEndFromStart(e.target.value, sessionDurationMin),
                            },
                          }))
                        }
                        className="rounded-lg border border-emerald-300 bg-white px-2 py-1 text-sm"
                      />
                      <span className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-800">
                        até {newSlotByDay[day]?.end}
                      </span>
                      <button
                        type="button"
                        onClick={() => createSlotForDay(day)}
                        className="ml-auto rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        Adicionar e liberar
                      </button>
                      <button
                        type="button"
                        onClick={() => cancelNewSlotEditor(day)}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Cancelar
                      </button>
                    </div>
                    <p className="mt-2 text-[11px] text-emerald-800/90">
                      Cada linha é um início de sessão; o fim exibido segue a duração padrão do perfil ({sessionDurationMin} min).
                    </p>
                  </div>
                ) : null}
                {indices.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500">Nenhum horário neste dia.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {indices.map(({ row, i }) => (
                      <li
                        key={`w-${i}`}
                        className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      >
                        <input
                          type="time"
                          step={TIME_INPUT_STEP_SEC}
                          value={row.start}
                          onChange={(e) => updateWeekly(i, { start: e.target.value })}
                          className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                        />
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                          até {row.end}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeWeekly(i)}
                          className="ml-auto text-xs text-rose-600 hover:underline"
                        >
                          Remover
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-emerald-900">Bloqueios pontuais</h2>
            <p className="mt-1 text-xs text-slate-500">Opcional: folgas e compromissos em datas específicas.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowBlocks((prev) => !prev)}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            {showBlocks ? "Fechar bloqueios" : "Gerenciar bloqueios"}
          </button>
        </div>

        {showBlocks ? (
        <>
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-4 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-600">Data</span>
            <input
              type="date"
              value={blockDate}
              onChange={(e) => setBlockDate(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={blockAllDay} onChange={(e) => setBlockAllDay(e.target.checked)} className="rounded border-slate-300 text-emerald-600" />
            <span className="text-sm text-slate-700">Dia inteiro</span>
          </label>
          {!blockAllDay ? (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-slate-600">De</span>
                <input
                  type="time"
                  value={blockStart}
                  onChange={(e) => setBlockStart(e.target.value)}
                  className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-slate-600">Até</span>
                <input
                  type="time"
                  value={blockEnd}
                  onChange={(e) => setBlockEnd(e.target.value)}
                  className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
                />
              </label>
            </>
          ) : null}
          <label className="min-w-[200px] flex flex-col gap-1 sm:flex-1">
            <span className="text-xs text-slate-600">Motivo (opcional)</span>
            <input
              value={blockNote}
              onChange={(e) => setBlockNote(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Ex.: viagem, capacitação"
            />
          </label>
          <button
            type="button"
            onClick={addBlock}
            disabled={!blockDate}
            className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            Adicionar bloqueio
          </button>
        </div>

        <ul className="mt-4 space-y-2">
          {data.blocks.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              <span className="font-medium text-slate-900">{b.isoDate}</span>
              <span className="text-slate-600">
                {b.allDay ? "Dia inteiro" : `${b.startTime ?? ""} – ${b.endTime ?? ""}`}
              </span>
              <span className="text-slate-500">{b.note}</span>
              <button type="button" onClick={() => removeBlock(b.id)} className="text-xs font-semibold text-rose-600 hover:underline">
                Excluir
              </button>
            </li>
          ))}
        </ul>
        </>
        ) : (
          <p className="mt-4 text-xs text-slate-500">
            {data.blocks.length === 0
              ? "Nenhum bloqueio cadastrado."
              : `${data.blocks.length} bloqueio(s) cadastrado(s).`}
          </p>
        )}
      </section>

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Abrir agenda com esta disponibilidade?</h3>
            <p className="mt-2 text-sm text-slate-600">
              Ao confirmar, os horários ficam publicados para novos agendamentos.
            </p>
            <p className="mt-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
              Importante: quando o paciente concluir o pagamento, a consulta será confirmada automaticamente.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmOpen(false);
                  void saveAvailabilityConfirmed();
                }}
                className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Confirmar e abrir agenda
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}
