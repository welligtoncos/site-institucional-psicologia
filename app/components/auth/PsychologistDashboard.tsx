"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { usePsychologistSession } from "@/app/components/auth/PsychologistAuthShell";
import {
  PSYCHOLOGIST_ALERTS_SEED,
  formatIsoDatePt,
  loadAgendaAppointments,
  todayIso,
  type PsychologistAgendaAppointment,
} from "@/app/lib/psicologo-mocks";

const ACCESS_TOKEN_KEY = "portal_access_token";
const REFRESH_TOKEN_KEY = "portal_refresh_token";

function sortByDateTime(list: PsychologistAgendaAppointment[]): PsychologistAgendaAppointment[] {
  return [...list].sort((a, b) => {
    const c = a.isoDate.localeCompare(b.isoDate);
    if (c !== 0) return c;
    return a.time.localeCompare(b.time);
  });
}

export function PsychologistDashboard() {
  const router = useRouter();
  const { name: userName, email: userEmail } = usePsychologistSession();
  const [agenda, setAgenda] = useState<PsychologistAgendaAppointment[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    function refresh() {
      setAgenda(loadAgendaAppointments());
    }
    refresh();
    setHydrated(true);
    window.addEventListener("storage", refresh);
    window.addEventListener("psychologist-agenda-changed", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("psychologist-agenda-changed", refresh);
    };
  }, []);

  const today = todayIso();

  const {
    resumoHoje,
    proximos,
    pacientesHoje,
    pendentesCount,
    pagamentosAlerta,
  } = useMemo(() => {
    const sorted = sortByDateTime(agenda);
    const ativos = sorted.filter((a) => a.status !== "cancelada");
    const hoje = ativos.filter((a) => a.isoDate === today);
    const futuros = ativos.filter((a) => a.isoDate >= today);
    const proximosSlice = futuros.slice(0, 5);
    const ids = new Set(hoje.map((a) => a.patientId));
    const pendentes = ativos.filter((a) => a.status === "pendente").length;
    const pagPend = ativos.filter((a) => a.pagamentoPendente).length;
    return {
      resumoHoje: hoje,
      proximos: proximosSlice,
      pacientesHoje: ids.size,
      pendentesCount: pendentes,
      pagamentosAlerta: pagPend,
    };
  }, [agenda, today]);

  function handleLogout() {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    router.push("/login?next=/psicologo");
  }

  if (!hydrated) {
    return (
      <div className="rounded-2xl border border-emerald-100 bg-white p-8 text-center text-sm text-slate-600">
        Carregando painel…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-teal-50/50 p-6 shadow-sm">
        <p className="text-sm font-medium text-emerald-900/80">Olá, {userName}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Painel inicial</h1>
        <p className="mt-2 max-w-xl text-sm text-slate-600">
          Resumo do dia, próximos atendimentos e alertas. Dados de demonstração — alterações na agenda são salvas neste
          navegador.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hoje</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{resumoHoje.length}</p>
          <p className="mt-1 text-xs text-slate-600">sessões agendadas (não canceladas)</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pacientes (hoje)</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{pacientesHoje}</p>
          <p className="mt-1 text-xs text-slate-600">pessoas distintas</p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">Pendências</p>
          <p className="mt-1 text-2xl font-semibold text-amber-950">{pendentesCount}</p>
          <p className="mt-1 text-xs text-amber-900/80">confirmações pendentes na agenda</p>
        </div>
        <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-900">Pagamentos</p>
          <p className="mt-1 text-2xl font-semibold text-rose-950">{pagamentosAlerta}</p>
          <p className="mt-1 text-xs text-rose-900/80">sessões com pagamento em aberto (mock)</p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-emerald-900">Resumo do dia</h2>
            <span className="text-xs text-slate-500">{formatIsoDatePt(today)}</span>
          </div>
          {resumoHoje.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">Nenhuma sessão para hoje nos dados de demonstração.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {resumoHoje.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium text-slate-900">{a.patientName}</p>
                    <p className="text-xs text-slate-600">
                      {a.time} ·{" "}
                      <span className={a.format === "Online" ? "text-teal-700" : "text-slate-700"}>{a.format}</span>
                      {a.status === "pendente" && (
                        <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                          Pendente
                        </span>
                      )}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-800">Próximos atendimentos</h2>
            <Link href="/psicologo/agenda" className="text-xs font-semibold text-emerald-700 hover:underline">
              Ver agenda
            </Link>
          </div>
          {proximos.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">Nenhum próximo atendimento.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {proximos.map((a) => (
                <li key={a.id} className="rounded-xl border border-slate-100 px-3 py-2 text-sm">
                  <p className="font-medium text-slate-900">{a.patientName}</p>
                  <p className="text-xs text-slate-600">
                    {formatIsoDatePt(a.isoDate)} · {a.time} · {a.format}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-800">Alertas</h2>
        <p className="mt-1 text-xs text-slate-500">Pagamentos, cancelamentos e mensagens (demonstração).</p>
        <ul className="mt-4 space-y-3">
          {PSYCHOLOGIST_ALERTS_SEED.map((al) => (
            <li
              key={al.id}
              className={`flex gap-3 rounded-xl border px-3 py-3 text-sm ${
                al.type === "pagamento"
                  ? "border-rose-100 bg-rose-50/50"
                  : al.type === "cancelamento"
                    ? "border-amber-100 bg-amber-50/50"
                    : "border-sky-100 bg-sky-50/50"
              }`}
            >
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  al.type === "pagamento"
                    ? "bg-rose-100 text-rose-900"
                    : al.type === "cancelamento"
                      ? "bg-amber-100 text-amber-900"
                      : "bg-sky-100 text-sky-900"
                }`}
              >
                {al.type === "pagamento" ? "Pagamento" : al.type === "cancelamento" ? "Cancelamento" : "Mensagem"}
              </span>
              <p className="text-slate-800">{al.message}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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
            {pendentesCount > 0 ? `${pendentesCount} pendente(s)` : "Consultas e ações"}
          </p>
        </Link>
        <Link
          href="/psicologo/sessao"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/50"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sessão ao vivo</p>
          <p className="mt-2 text-sm font-medium text-slate-900">Cronômetro no horário</p>
        </Link>
        <Link
          href="/psicologo/pacientes"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/50"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pacientes</p>
          <p className="mt-2 text-sm font-medium text-slate-900">Lista e prontuário (demo)</p>
        </Link>
        <Link
          href="/psicologo/faturas"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/50"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Minhas consultas</p>
          <p className="mt-2 text-sm font-medium text-slate-900">Histórico, pagamento e fatura</p>
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
