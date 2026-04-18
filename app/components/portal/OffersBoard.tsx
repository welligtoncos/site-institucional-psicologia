"use client";

import Link from "next/link";

import { MOCK_PSYCHOLOGIST } from "@/app/lib/portal-mocks";

export function OffersBoard() {
  const psych = MOCK_PSYCHOLOGIST;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-sky-100 bg-gradient-to-r from-sky-50 to-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Profissional</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">{psych.name}</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">Dados de demonstração — uma psicóloga cadastrada na clínica.</p>
      </section>

      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex gap-4 p-5">
          <div
            className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${psych.avatarClass} text-lg font-bold text-white shadow-inner`}
            aria-hidden
          >
            {psych.initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-sky-700">CRP {psych.crp}</p>
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
          <Link
            href={`/portal/agendar?psych=${encodeURIComponent(psych.id)}`}
            className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700"
          >
            Agendar consulta
          </Link>
        </div>
      </article>
    </div>
  );
}
