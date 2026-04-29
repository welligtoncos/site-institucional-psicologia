"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { usePsychologistSession } from "@/app/components/auth/PsychologistAuthShell";
import { LiveSessionHomeBanner } from "@/app/components/shared/LiveSessionHomeBanner";
import { type PsychologistAgendaAppointment, todayIso } from "@/app/lib/psicologo-mocks";
import { apiAgendaToMock, fetchPsychologistAgenda } from "@/app/lib/psychologist-agenda-api";

const ACCESS_TOKEN_KEY = "portal_access_token";
const REFRESH_TOKEN_KEY = "portal_refresh_token";

function parseAppointmentStart(isoDate: string, hhmm: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  const [hour, minute] = hhmm.split(":").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, hour ?? 0, minute ?? 0, 0, 0);
}

function formatAppointmentDatePt(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

function isPsychAppointmentUpcoming(a: PsychologistAgendaAppointment): boolean {
  const start = parseAppointmentStart(a.isoDate, a.time);
  return (
    start.getTime() >= Date.now() &&
    a.status !== "cancelada" &&
    a.status !== "realizada"
  );
}

function sortByDateTime(list: PsychologistAgendaAppointment[]): PsychologistAgendaAppointment[] {
  return [...list].sort((a, b) => {
    const c = a.isoDate.localeCompare(b.isoDate);
    if (c !== 0) return c;
    return a.time.localeCompare(b.time);
  });
}

function sortByDateTimeDesc(list: PsychologistAgendaAppointment[]): PsychologistAgendaAppointment[] {
  return [...list].sort((a, b) => {
    const c = b.isoDate.localeCompare(a.isoDate);
    if (c !== 0) return c;
    return b.time.localeCompare(a.time);
  });
}

export function PsychologistDashboard() {
  const router = useRouter();
  const { name: userName } = usePsychologistSession();
  const [agenda, setAgenda] = useState<PsychologistAgendaAppointment[]>([]);
  const [loadError, setLoadError] = useState("");

  const reload = useCallback(async () => {
    const result = await fetchPsychologistAgenda(todayIso());
    if (result.ok && "appointments" in result.data) {
      const mapped = apiAgendaToMock(result.data);
      setAgenda(mapped.appointments);
      setLoadError("");
      return;
    }
    setAgenda([]);
    setLoadError(
      "detail" in result.data && typeof result.data.detail === "string"
        ? result.data.detail
        : "Não foi possível carregar sua agenda.",
    );
  }, []);

  useEffect(() => {
    void reload();
    const onAgendaChanged = () => {
      void reload();
    };
    window.addEventListener("psychologist-availability-changed", onAgendaChanged);
    window.addEventListener("psychologist-agenda-changed", onAgendaChanged);
    return () => {
      window.removeEventListener("psychologist-availability-changed", onAgendaChanged);
      window.removeEventListener("psychologist-agenda-changed", onAgendaChanged);
    };
  }, [reload]);

  const next = useMemo(() => {
    const visible = agenda.filter((a) => a.status === "confirmada" || a.status === "pendente" || a.status === "em_andamento");
    const inProgress = sortByDateTimeDesc(visible.filter((a) => a.status === "em_andamento"));
    if (inProgress.length > 0) return inProgress[0] ?? null;

    const upcoming = sortByDateTime(visible.filter(isPsychAppointmentUpcoming));
    if (upcoming.length > 0) return upcoming[0] ?? null;

    const recent = sortByDateTimeDesc(visible);
    return recent[0] ?? null;
  }, [agenda]);

  const primaryAction = useMemo(() => {
    if (!next) {
      return {
        label: "Ver agenda",
        href: "/psicologo/agenda",
        tone: "sky" as const,
        sub: "Organize seus horários e atendimentos na semana.",
      };
    }
    if (next.format === "Online" && (next.status === "confirmada" || next.status === "em_andamento")) {
      return {
        label: "Entrar na sessão de atendimento",
        href: "/psicologo/sessao",
        tone: "emerald" as const,
        sub: "A videochamada da consulta é aberta na Sala de atendimento.",
      };
    }
    return {
      label: "Ver minha agenda",
      href: "/psicologo/agenda",
      tone: "slate" as const,
      sub: "Detalhes, histórico e próximos horários.",
    };
  }, [next]);

  const primaryToneClass =
    primaryAction.tone === "emerald"
      ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/20"
      : primaryAction.tone === "amber"
        ? "bg-amber-600 hover:bg-amber-700 shadow-amber-900/15"
        : primaryAction.tone === "sky"
          ? "bg-sky-600 hover:bg-sky-700 shadow-sky-900/15"
          : "bg-slate-700 hover:bg-slate-800 shadow-slate-900/20";

  const firstName = userName.trim().split(/\s+/)[0] || "você";

  function handleLogout() {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    router.push("/login?next=/psicologo");
  }

  return (
    <div className="space-y-8 pb-10">
      <LiveSessionHomeBanner role="psychologist" />
      <section className="overflow-hidden rounded-2xl border border-sky-100/80 bg-gradient-to-br from-sky-50 via-white to-indigo-50/40 p-6 shadow-sm sm:p-8">
        <p className="text-sm font-medium text-sky-900/90">
          Olá, <span className="font-semibold text-slate-900">{firstName}</span>. Aqui você acompanha seus atendimentos de
          forma simples.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-slate-600">
          Os dados dos pacientes e o conteúdo clínico são sigilosos. Em caso de dúvida, use os canais de suporte da clínica.
        </p>

        <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-stretch lg:justify-between">
          <div className="min-w-0 flex-1 rounded-2xl border border-white/80 bg-white/90 p-5 shadow-sm backdrop-blur-sm">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-sky-800">Próximo atendimento</p>
            {next ? (
              <>
                <p className="mt-2 text-lg font-semibold tracking-tight text-slate-900">
                  {formatAppointmentDatePt(next.isoDate)} às {next.time}
                </p>
                <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
                  <li>
                    <span className="text-slate-500">Paciente:</span>{" "}
                    <span className="font-medium text-slate-900">{next.patientName}</span>
                  </li>
                  <li>
                    <span className="text-slate-500">Modalidade:</span>{" "}
                    <span className="font-medium text-slate-900">{next.format}</span>
                  </li>
                </ul>
              </>
            ) : (
              <p className="mt-3 text-sm text-slate-600">
                Não há atendimento futuro na agenda. Confira disponibilidade ou aguarde novos agendamentos.
              </p>
            )}
          </div>

          <div className="flex w-full shrink-0 flex-col justify-center gap-3 lg:max-w-sm">
            <Link
              href={primaryAction.href}
              className={`inline-flex w-full items-center justify-center rounded-2xl px-6 py-4 text-center text-sm font-semibold text-white shadow-lg transition ${primaryToneClass}`}
            >
              {primaryAction.label}
            </Link>
            <p className="text-center text-xs leading-relaxed text-slate-600 lg:text-left">{primaryAction.sub}</p>
            <div className="flex flex-wrap justify-center gap-2 lg:justify-start">
              <Link
                href="/psicologo/agenda"
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Ver agenda completa
              </Link>
            </div>
          </div>
        </div>
      </section>

      {loadError ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{loadError}</section>
      ) : null}

      <section className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5 sm:p-6" id="privacidade-profissional">
        <h2 className="text-base font-semibold text-indigo-950">Sigilo e ética profissional</h2>
        <p className="mt-2 text-sm leading-relaxed text-indigo-950/85">
          Este painel reúne organização da agenda e aspectos administrativos. Registros clínicos sensíveis permanecem no
          contexto apropriado da prática; trate os dados dos pacientes com o mesmo cuidado do portal do paciente.
        </p>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-6">
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Sair do portal
        </button>
        <p className="text-xs text-slate-500">Dúvidas? Use suporte no rodapé da página.</p>
      </div>
    </div>
  );
}
