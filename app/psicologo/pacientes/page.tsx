import type { Metadata } from "next";
import Link from "next/link";

import { PsychologistAuthShell } from "@/app/components/auth/PsychologistAuthShell";

export const metadata: Metadata = {
  title: "Pacientes",
  robots: { index: false, follow: false },
};

export default function PsicologoPacientesPage() {
  return (
    <PsychologistAuthShell>
      <article className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Pacientes</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Lista de pacientes atendidos nesta clínica ficará disponível aqui, com filtros e busca, respeitando sigilo e
          consentimento conforme CFP e LGPD.
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
