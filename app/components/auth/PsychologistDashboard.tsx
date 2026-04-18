"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { usePsychologistSession } from "@/app/components/auth/PsychologistAuthShell";

const ACCESS_TOKEN_KEY = "portal_access_token";
const REFRESH_TOKEN_KEY = "portal_refresh_token";

type Slot = {
  id: string;
  patient: string;
  time: string;
  modality: "Online" | "Presencial";
  status: "Confirmada" | "Pendente";
};

const TODAY_SLOTS: Slot[] = [
  { id: "1", patient: "Inicial M.", time: "09:00", modality: "Presencial", status: "Confirmada" },
  { id: "2", patient: "Paulo R.", time: "11:30", modality: "Online", status: "Confirmada" },
  { id: "3", patient: "Juliana T.", time: "15:00", modality: "Online", status: "Pendente" },
];

const WEEK_SLOTS: Slot[] = [
  { id: "4", patient: "Marcos A.", time: "Ter 10:00", modality: "Presencial", status: "Confirmada" },
  { id: "5", patient: "Carla S.", time: "Qui 16:30", modality: "Online", status: "Confirmada" },
];

export function PsychologistDashboard() {
  const router = useRouter();
  const { name: userName, email: userEmail } = usePsychologistSession();

  function handleLogout() {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    router.push("/login");
  }

  const todayCount = useMemo(() => TODAY_SLOTS.length, []);
  const weekCount = useMemo(() => WEEK_SLOTS.length, []);

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-teal-50/50 p-6 shadow-sm">
        <p className="text-sm font-medium text-emerald-900/80">Olá, {userName}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">Painel do psicólogo</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          Visão rápida da sua agenda e dos próximos atendimentos. Os dados abaixo são exemplos até a integração com a
          agenda da clínica.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Hoje</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-800">{todayCount}</p>
          <p className="text-sm text-slate-600">atendimentos previstos</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Esta semana</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{weekCount + todayCount}</p>
          <p className="text-sm text-slate-600">no total (inclui hoje)</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Contato</p>
          <p className="mt-2 truncate text-sm font-medium text-slate-900">{userEmail}</p>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-3 text-sm font-semibold text-emerald-700 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-900"
          >
            Sair da conta
          </button>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-emerald-800">Hoje</h2>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">Exemplo</span>
          </div>
          <ul className="mt-4 space-y-3">
            {TODAY_SLOTS.map((slot) => (
              <li
                key={slot.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-slate-900">{slot.patient}</p>
                  <p className="text-xs text-slate-500">
                    {slot.time} · {slot.modality}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    slot.status === "Confirmada"
                      ? "bg-emerald-100 text-emerald-900"
                      : "bg-amber-100 text-amber-900"
                  }`}
                >
                  {slot.status}
                </span>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-emerald-800">Próximos</h2>
            <Link href="/psicologo/agenda" className="text-xs font-semibold text-emerald-700 hover:underline">
              Ver agenda completa
            </Link>
          </div>
          <ul className="mt-4 space-y-3">
            {WEEK_SLOTS.map((slot) => (
              <li
                key={slot.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-slate-900">{slot.patient}</p>
                  <p className="text-xs text-slate-500">
                    {slot.time} · {slot.modality}
                  </p>
                </div>
                <span className="text-xs font-medium text-slate-600">{slot.status}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
        <p className="text-sm text-slate-600">
          Em breve: integração com prontuário, notas de sessão e lista unificada de pacientes — sempre em conformidade
          com a ética profissional e a LGPD.
        </p>
      </section>
    </div>
  );
}
