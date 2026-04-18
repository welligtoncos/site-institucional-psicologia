"use client";

import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  PSYCHOLOGIST_PROFILE_SEED,
  type PsychologistProfileMock,
} from "@/app/lib/psicologo-mocks";

const STORAGE_KEY = "psychologist_profile_mock_v1";

function loadProfile(): PsychologistProfileMock {
  if (typeof window === "undefined") return PSYCHOLOGIST_PROFILE_SEED;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return PSYCHOLOGIST_PROFILE_SEED;
    const p = JSON.parse(raw) as PsychologistProfileMock;
    if (typeof p.crp !== "string") return PSYCHOLOGIST_PROFILE_SEED;
    return {
      ...PSYCHOLOGIST_PROFILE_SEED,
      ...p,
      specialties: Array.isArray(p.specialties) ? p.specialties : PSYCHOLOGIST_PROFILE_SEED.specialties,
    };
  } catch {
    return PSYCHOLOGIST_PROFILE_SEED;
  }
}

export function PsychologistProfileForm() {
  const [data, setData] = useState<PsychologistProfileMock>(PSYCHOLOGIST_PROFILE_SEED);
  const [tagInput, setTagInput] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setData(loadProfile());
    setHydrated(true);
  }, []);

  function persist(next: PsychologistProfileMock) {
    setData(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    persist(data);
    toast.success("Perfil salvo neste navegador.");
  }

  function handlePhotoFile(file: File | null) {
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 450 * 1024) {
      toast.error("Imagem deve ter menos de 450 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = typeof reader.result === "string" ? reader.result : "";
      persist({ ...data, photoDataUrl: url });
      toast.success("Foto atualizada.");
    };
    reader.readAsDataURL(file);
  }

  function addTag() {
    const t = tagInput.trim();
    if (!t || data.specialties.includes(t)) return;
    persist({ ...data, specialties: [...data.specialties, t] });
    setTagInput("");
  }

  function removeTag(tag: string) {
    persist({ ...data, specialties: data.specialties.filter((s) => s !== tag) });
  }

  if (!hydrated) {
    return (
      <div className="rounded-2xl border border-emerald-100 bg-white p-8 text-center text-sm text-slate-600">
        Carregando perfil…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800">Perfil profissional</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Seus dados na clínica</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          CRP, biografia, valor da sessão, foto e especialidades visíveis para pacientes nesta demonstração (salvo apenas
          no seu navegador).
        </p>
      </section>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 sm:flex-row">
          <div className="flex flex-col items-center gap-3">
            <div
              className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 text-slate-400"
              style={
                data.photoDataUrl
                  ? { backgroundImage: `url(${data.photoDataUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
                  : undefined
              }
            >
              {!data.photoDataUrl ? <span className="text-xs text-center px-2">Sem foto</span> : null}
            </div>
            <label className="cursor-pointer rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-100">
              Escolher foto
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoFile(e.target.files?.[0] ?? null)} />
            </label>
            {data.photoDataUrl ? (
              <button
                type="button"
                onClick={() => persist({ ...data, photoDataUrl: "" })}
                className="text-xs text-slate-500 underline hover:text-slate-800"
              >
                Remover foto
              </button>
            ) : null}
          </div>

          <div className="min-w-0 flex-1 space-y-4">
            <label className="block">
              <span className="text-xs font-medium text-slate-600">CRP</span>
              <input
                required
                value={data.crp}
                onChange={(e) => setData({ ...data, crp: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                placeholder="06/123456"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Valor da sessão (R$)</span>
              <input
                required
                type="number"
                min={1}
                step={1}
                value={data.sessionPrice || ""}
                onChange={(e) => setData({ ...data, sessionPrice: Number(e.target.value) })}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              />
            </label>
          </div>
        </div>

        <label className="block">
          <span className="text-xs font-medium text-slate-600">Biografia</span>
          <textarea
            required
            rows={5}
            value={data.bio}
            onChange={(e) => setData({ ...data, bio: e.target.value })}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            placeholder="Resumo da sua atuação, formação e linhas de trabalho."
          />
        </label>

        <div>
          <span className="text-xs font-medium text-slate-600">Especialidades</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {data.specialties.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm text-emerald-900"
              >
                {s}
                <button type="button" onClick={() => removeTag(s)} className="text-emerald-700 hover:text-rose-600" aria-label={`Remover ${s}`}>
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
              className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="Digite e pressione Enter"
            />
            <button type="button" onClick={addTag} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50">
              Adicionar
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
          <button type="submit" className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
            Salvar perfil
          </button>
        </div>
      </form>
    </div>
  );
}
