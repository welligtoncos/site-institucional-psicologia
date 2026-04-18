import type { Metadata } from "next";
import Link from "next/link";

import { PsychologistAuthShell } from "@/app/components/auth/PsychologistAuthShell";

export const metadata: Metadata = {
  title: "Agenda",
  robots: { index: false, follow: false },
};

export default function PsicologoAgendaPage() {
  return (
    <PsychologistAuthShell>
      <article className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Agenda completa</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Em construção: visão semanal ou mensal dos seus atendimentos, alinhada à agenda da clínica e ao calendário
          profissional.
        </p>
        <p className="mt-4 text-sm text-slate-500">
          Por enquanto, use o <strong className="font-medium text-slate-700">painel</strong> para ver exemplos de
          horários do dia e da semana.
        </p>
        <Link
          href="/psicologo"
          className="mt-6 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100"
        >
          Voltar ao painel
        </Link>
      </article>
    </PsychologistAuthShell>
  );
}
