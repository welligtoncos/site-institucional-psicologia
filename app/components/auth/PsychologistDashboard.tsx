"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { usePsychologistSession } from "@/app/components/auth/PsychologistAuthShell";
import { type PsychologistAgendaAppointment, todayIso } from "@/app/lib/psicologo-mocks";
import { apiAgendaToMock, fetchPsychologistAgenda } from "@/app/lib/psychologist-agenda-api";

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
  const [loadError, setLoadError] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    async function refresh() {
      const result = await fetchPsychologistAgenda(todayIso());
      if (result.ok && "appointments" in result.data) {
        const mapped = apiAgendaToMock(result.data);
        setAgenda(mapped.appointments);
        setLoadError("");
        setHydrated(true);
        return;
      }
      setAgenda([]);
      setLoadError(
        "Não foi possível carregar os dados do painel pela API. Verifique sua sessão e disponibilidade do backend.",
      );
      setHydrated(true);
    }
    void refresh();
    const onAgendaChanged = () => {
      void refresh();
    };
    window.addEventListener("psychologist-availability-changed", onAgendaChanged);
    window.addEventListener("psychologist-agenda-changed", onAgendaChanged);
    return () => {
      window.removeEventListener("psychologist-availability-changed", onAgendaChanged);
      window.removeEventListener("psychologist-agenda-changed", onAgendaChanged);
    };
  }, []);

  const today = todayIso();
  const formatIsoDatePt = (isoDate: string): string => {
    const [y, m, d] = isoDate.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    });
  };

  const {
    resumoHoje,
    proximos,
    pagamentosAlerta,
  } = useMemo(() => {
    const sorted = sortByDateTime(agenda);
    const ativos = sorted.filter((a) => a.status !== "cancelada");
    const hoje = ativos.filter((a) => a.isoDate === today);
    const futuros = ativos.filter((a) => a.isoDate >= today);
    const proximosSlice = futuros.slice(0, 5);
    const pagPend = ativos.filter((a) => a.pagamentoPendente).length;
    return {
      resumoHoje: hoje,
      proximos: proximosSlice,
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
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Sua agenda profissional</h1>
        <p className="mt-2 max-w-xl text-sm text-slate-600">
          Acompanhe seus atendimentos de hoje, próximos horários e pendências da agenda em tempo real.
        </p>
      </section>
      {loadError ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{loadError}</section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hoje</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{resumoHoje.length}</p>
          <p className="mt-1 text-xs text-slate-600">sessões agendadas</p>
        </div>
        <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-900">Pagamentos</p>
          <p className="mt-1 text-2xl font-semibold text-rose-950">{pagamentosAlerta}</p>
          <p className="mt-1 text-xs text-rose-900/80">sessões com pagamento em aberto</p>
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
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-800">Atalhos rápidos</h2>
        <p className="mt-1 text-xs text-slate-500">Acesse as áreas principais com um clique.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Link
            href="/psicologo/faturas"
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:border-emerald-200 hover:bg-emerald-50/50"
          >
            Minhas consultas
          </Link>
          <Link
            href="/psicologo/sessao"
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:border-emerald-200 hover:bg-emerald-50/50"
          >
            Atendimento
          </Link>
        </div>
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
