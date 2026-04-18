"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { usePsychologistSession } from "@/app/components/auth/PsychologistAuthShell";
import { PSYCHOLOGIST_AGENDA_SEED } from "@/app/lib/psicologo-mocks";

const ACCESS_TOKEN_KEY = "portal_access_token";
const REFRESH_TOKEN_KEY = "portal_refresh_token";

export function PsychologistDashboard() {
  const router = useRouter();
  const { name: userName, email: userEmail } = usePsychologistSession();

  function handleLogout() {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    router.push("/login");
  }

  const pendentes = PSYCHOLOGIST_AGENDA_SEED.filter((a) => a.status === "pendente").length;

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-teal-50/50 p-6 shadow-sm">
        <p className="text-sm font-medium text-emerald-900/80">Olá, {userName}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Painel</h1>
        <p className="mt-2 max-w-xl text-sm text-slate-600">Acesse perfil, disponibilidade e agenda.</p>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Link
          href="/psicologo/perfil"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/50"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Perfil</p>
          <p className="mt-2 text-sm font-medium text-slate-900">CRP, bio e valor</p>
        </Link>
        <Link
          href="/psicologo/disponibilidade"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/50"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Disponibilidade</p>
          <p className="mt-2 text-sm font-medium text-slate-900">Horários e bloqueios</p>
        </Link>
        <Link
          href="/psicologo/agenda"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/50"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Agenda</p>
          <p className="mt-2 text-sm font-medium text-slate-900">
            {pendentes > 0 ? `${pendentes} pendente(s)` : "Ver consultas"}
          </p>
        </Link>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="truncate text-sm text-slate-600">
          <span className="font-medium text-slate-900">{userEmail}</span>
        </p>
        <button
          type="button"
          onClick={handleLogout}
          className="text-sm font-semibold text-emerald-700 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-900"
        >
          Sair
        </button>
      </section>
    </div>
  );
}
