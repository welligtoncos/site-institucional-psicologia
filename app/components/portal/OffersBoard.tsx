"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  ALL_SPECIALTY_LABELS,
  filterPsychologists,
  type MockPsychologist,
} from "@/app/lib/portal-mocks";

const MAX_PRICE_SLIDER = 300;

export function OffersBoard() {
  const [specialty, setSpecialty] = useState<string>("todas");
  const [maxPrice, setMaxPrice] = useState(MAX_PRICE_SLIDER);
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  const specialtyOptions = useMemo(() => ["todas", ...ALL_SPECIALTY_LABELS], []);

  const visible = useMemo(() => {
    const spec = specialty === "todas" ? "todas" : specialty;
    return filterPsychologists({
      specialty: spec,
      maxPrice,
      onlyAvailable,
    });
  }, [specialty, maxPrice, onlyAvailable]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-sky-100 bg-gradient-to-r from-sky-50 to-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Psicólogos ativos</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Conheça a equipe</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
          Profissionais em atividade na clínica, com especialidades, biografia resumida e valor da sessão (dados de
          demonstração no navegador).
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">Filtros</p>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-start">
          <label className="flex min-w-[200px] max-w-full flex-1 flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Especialidade</span>
            <select
              name="portal-offers-specialty"
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
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Preço máximo (R$ {maxPrice})
            </span>
            <input
              type="range"
              min={150}
              max={MAX_PRICE_SLIDER}
              step={10}
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
              className="w-full accent-sky-600"
            />
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5">
            <input
              type="checkbox"
              checked={onlyAvailable}
              onChange={(e) => setOnlyAvailable(e.target.checked)}
              className="rounded border-slate-300 text-sky-600"
            />
            <span className="text-sm text-slate-700">Só com horário disponível esta semana</span>
          </label>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-2">
        {visible.map((p) => (
          <PsychologistCard key={p.id} psych={p} />
        ))}
      </section>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Nenhum profissional encontrado com esses filtros. Ajuste especialidade, preço ou disponibilidade.
        </p>
      ) : null}
    </div>
  );
}

function PsychologistCard({ psych }: { psych: MockPsychologist }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex gap-4 p-5">
        <div
          className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${psych.avatarClass} text-lg font-bold text-white shadow-inner`}
          aria-hidden
        >
          {psych.initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-sky-700">CRP {psych.crp}</p>
          <h2 className="mt-0.5 text-xl font-semibold text-slate-900">{psych.name}</h2>
          <p className="mt-1 text-xs text-slate-500">{psych.specialties.join(" · ")}</p>
        </div>
      </div>
      <div className="border-t border-slate-100 px-5 py-4">
        <p className="text-sm leading-relaxed text-slate-600">{psych.bio}</p>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm text-slate-700 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-slate-500">Valor</dt>
            <dd className="font-semibold text-slate-900">R$ {psych.price.toFixed(2).replace(".", ",")}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Duração</dt>
            <dd>{psych.durationMin} min</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Formato</dt>
            <dd>{psych.formats.join(" · ")}</dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              psych.availableThisWeek ? "bg-emerald-100 text-emerald-900" : "bg-slate-100 text-slate-600"
            }`}
          >
            {psych.availableThisWeek ? "Horários esta semana" : "Sem agenda mock esta semana"}
          </span>
        </div>
        <Link
          href={`/portal/agendar?psych=${encodeURIComponent(psych.id)}`}
          className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700"
        >
          Agendar com {psych.name.split(" ")[0]}
        </Link>
      </div>
    </article>
  );
}
