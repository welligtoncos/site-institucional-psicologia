"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

export function PsychologistAvailabilityBoard() {
  const [data, setData] = useState<PsychologistAvailabilityMock>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const [loadError, setLoadError] = useState<"forbidden" | "generic" | null>(null);
  /** Evita disparar PUT antes do primeiro GET completar. */
  const initialLoadDoneRef = useRef(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const [blockDate, setBlockDate] = useState("");
  const [blockAllDay, setBlockAllDay] = useState(true);
  const [blockStart, setBlockStart] = useState("12:00");
  const [blockEnd, setBlockEnd] = useState("13:00");
  const [blockNote, setBlockNote] = useState("");

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const queueSave = useCallback((snapshot: PsychologistAvailabilityMock) => {
    if (!initialLoadDoneRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void (async () => {
        setSaveStatus("saving");
        const result = await putPsychologistAvailability(mockToApiPayload(snapshot));
        if (result.ok && "weekly" in result.data) {
          setData(apiToMock(result.data as ApiPsychologistAvailability));
          setSaveStatus("saved");
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("psychologist-availability-changed"));
          }
          return;
        }
        setSaveStatus("idle");
        const detail =
          "detail" in result.data && typeof result.data.detail === "string"
            ? result.data.detail
            : "Não foi possível salvar a disponibilidade.";
        toast.error(detail);
      })();
    }, 1200);
  }, []);

  useEffect(() => {
    if (saveStatus !== "saved") return;
    const t = window.setTimeout(() => setSaveStatus("idle"), 2200);
    return () => window.clearTimeout(t);
  }, [saveStatus]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await fetchPsychologistAvailability();
      if (cancelled) return;
      if (result.ok && "weekly" in result.data) {
        setData(apiToMock(result.data as ApiPsychologistAvailability));
        setLoadError(null);
        initialLoadDoneRef.current = true;
      } else if (result.status === 403) {
        setLoadError("forbidden");
      } else {
        setLoadError("generic");
        initialLoadDoneRef.current = true;
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

  function updateWeekly(index: number, patch: Partial<DaySlot>) {
    setData((prev) => {
      const weekly = prev.weekly.map((row, i) => (i === index ? { ...row, ...patch } : row));
      const next = { ...prev, weekly };
      queueSave(next);
      return next;
    });
  }

  function removeWeekly(index: number) {
    setData((prev) => {
      const next = { ...prev, weekly: prev.weekly.filter((_, i) => i !== index) };
      queueSave(next);
      return next;
    });
  }

  function addWeeklySlot(day: Weekday) {
    setData((prev) => {
      const next = {
        ...prev,
        weekly: [...prev.weekly, { weekday: day, enabled: true, start: "09:00", end: "18:00" }],
      };
      queueSave(next);
      return next;
    });
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
    setData((prev) => {
      const next = { ...prev, blocks: [...prev.blocks, b] };
      queueSave(next);
      return next;
    });
    setBlockNote("");
    toast.success("Bloqueio adicionado.");
  }

  function removeBlock(id: string) {
    setData((prev) => {
      const next = { ...prev, blocks: prev.blocks.filter((b) => b.id !== id) };
      queueSave(next);
      return next;
    });
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
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800">Disponibilidade</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">Horários e bloqueios</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Defina quando você atende na semana e registre dias ou intervalos indisponíveis. As alterações são salvas no
              servidor (sincronizadas com a sua conta). No portal do paciente (Agendar), só aparecem horários ainda
              livres para marcar — com base nesta configuração, bloqueios e consultas já agendadas.
            </p>
            {loadError === "generic" ? (
              <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
                Não foi possível carregar os dados salvos. Verifique se a API está no ar e tente atualizar a página.
              </p>
            ) : null}
          </div>
          <p className="text-xs font-medium text-slate-500" aria-live="polite">
            {saveStatus === "saving" ? "Salvando…" : saveStatus === "saved" ? "Salvo." : null}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-emerald-900">Semana tipo</h2>
        <p className="mt-1 text-xs text-slate-500">Marque o dia, ajuste início/fim e adicione mais de um intervalo no mesmo dia se precisar.</p>

        <div className="mt-6 space-y-6">
          {WEEKDAY_ORDER.map((day) => {
            const indices = data.weekly
              .map((row, i) => ({ row, i }))
              .filter(({ row }) => row.weekday === day);
            return (
              <div key={day} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">{WEEKDAY_LONG[day]}</h3>
                  <button
                    type="button"
                    onClick={() => addWeeklySlot(day)}
                    className="text-xs font-semibold text-emerald-700 hover:underline"
                  >
                    + Adicionar intervalo
                  </button>
                </div>
                {indices.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500">Nenhum horário neste dia.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {indices.map(({ row, i }) => (
                      <li
                        key={`w-${i}`}
                        className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      >
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={row.enabled}
                            onChange={(e) => updateWeekly(i, { enabled: e.target.checked })}
                            className="rounded border-slate-300 text-emerald-600"
                          />
                          <span className="text-xs text-slate-600">Ativo</span>
                        </label>
                        <input
                          type="time"
                          value={row.start}
                          onChange={(e) => updateWeekly(i, { start: e.target.value })}
                          className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                        />
                        <span className="text-slate-400">—</span>
                        <input
                          type="time"
                          value={row.end}
                          onChange={(e) => updateWeekly(i, { end: e.target.value })}
                          className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                        />
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
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-emerald-900">Bloqueios pontuais</h2>
        <p className="mt-1 text-xs text-slate-500">Folgas, cursos ou compromissos que impedem atendimento em data específica.</p>

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
      </section>

    </div>
  );
}
