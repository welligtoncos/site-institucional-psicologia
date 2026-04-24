"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { usePortalPatientSession } from "@/app/components/auth/PortalGate";
import { LiveSessionHomeBanner } from "@/app/components/shared/LiveSessionHomeBanner";
import { listPatientAppointments, type ApiPatientAppointmentSummary } from "@/app/lib/portal-appointments-api";
import { siteConfig } from "@/app/lib/site";

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

function isAppointmentUpcoming(a: ApiPatientAppointmentSummary): boolean {
  const start = parseAppointmentStart(a.iso_date, a.time);
  return start.getTime() >= Date.now() && a.status !== "cancelada" && a.status !== "nao_compareceu";
}

export function PatientPortalDashboard() {
  const { userName, logout } = usePortalPatientSession();
  const [rows, setRows] = useState<ApiPatientAppointmentSummary[]>([]);
  const [loadError, setLoadError] = useState("");

  const reload = useCallback(async () => {
    const from = new Date();
    from.setMonth(from.getMonth() - 3);
    const fromIso = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-${String(from.getDate()).padStart(2, "0")}`;
    const result = await listPatientAppointments(fromIso);
    if (result.ok) {
      setRows(result.data.appointments);
      setLoadError("");
      return;
    }
    setRows([]);
    setLoadError(result.detail || "Não foi possível carregar suas consultas.");
  }, []);

  useEffect(() => {
    void reload();
    function onBilling() {
      void reload();
    }
    window.addEventListener("portal-billing-changed", onBilling);
    window.addEventListener("storage", onBilling);
    return () => {
      window.removeEventListener("portal-billing-changed", onBilling);
      window.removeEventListener("storage", onBilling);
    };
  }, [reload]);

  const upcoming = useMemo(() => {
    const visibleRows = rows.filter((a) => a.status === "confirmada" || a.payment === "Pendente");
    return visibleRows
      .filter(isAppointmentUpcoming)
      .sort((a, b) => parseAppointmentStart(a.iso_date, a.time).getTime() - parseAppointmentStart(b.iso_date, b.time).getTime());
  }, [rows]);

  const next = upcoming[0] ?? null;
  const confirmedCount = useMemo(() => rows.filter((a) => a.status === "confirmada").length, [rows]);
  const pendingPaymentCount = useMemo(() => rows.filter((a) => a.payment === "Pendente").length, [rows]);

  const primaryAction = useMemo(() => {
    if (!next) {
      return { label: "Agendar consulta", href: "/portal/agendar", tone: "sky" as const, sub: "Escolha data e horário com a clínica." };
    }
    if (next.payment === "Pendente") {
      return {
        label: "Pagar consulta",
        href: "/portal/faturamento",
        tone: "amber" as const,
        sub: "Regularize o pagamento para confirmar o horário.",
      };
    }
    if (next.format === "Online" && (next.status === "confirmada" || next.status === "em_andamento")) {
      return {
        label: "Entrar na sessão de atendimento",
        href: "/portal/consultas/sala",
        tone: "emerald" as const,
        sub: "A videochamada da consulta é aberta na Sala de atendimento.",
      };
    }
    return {
      label: "Ver minhas consultas",
      href: "/portal/consultas",
      tone: "slate" as const,
      sub: "Reagendar, cancelar ou ver detalhes.",
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

  return (
    <div className="space-y-8 pb-10">
      <LiveSessionHomeBanner role="patient" />
      {/* Topo: acolhimento + resumo + CTA */}
      <section className="overflow-hidden rounded-2xl border border-sky-100/80 bg-gradient-to-br from-sky-50 via-white to-indigo-50/40 p-6 shadow-sm sm:p-8">
        <p className="text-sm font-medium text-sky-900/90">
          Olá, <span className="font-semibold text-slate-900">{firstName}</span>. Aqui você acompanha suas consultas de forma simples.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-slate-600">
          Seus dados são sigilosos. Em caso de dúvida, fale com a recepção.
        </p>

        <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-stretch lg:justify-between">
          <div className="min-w-0 flex-1 rounded-2xl border border-white/80 bg-white/90 p-5 shadow-sm backdrop-blur-sm">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-sky-800">Próxima consulta</p>
            {next ? (
              <>
                <p className="mt-2 text-lg font-semibold tracking-tight text-slate-900">
                  {formatAppointmentDatePt(next.iso_date)} às {next.time}
                </p>
                <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
                  <li>
                    <span className="text-slate-500">Psicólogo(a):</span>{" "}
                    <span className="font-medium text-slate-900">{next.psychologist_name}</span>
                  </li>
                  <li>
                    <span className="text-slate-500">Modalidade:</span>{" "}
                    <span className="font-medium text-slate-900">{next.format}</span>
                  </li>
                </ul>
              </>
            ) : (
              <p className="mt-3 text-sm text-slate-600">Não há consulta futura agendada. Que tal marcar um horário?</p>
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
                href="/portal/agendar"
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Agendar nova consulta
              </Link>
              {next?.payment === "Pendente" ? (
                <Link
                  href="/portal/faturamento"
                  className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                >
                  Ver cobrança
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-base font-semibold text-slate-900">Resumo</h2>
        <p className="mt-1 text-sm text-slate-600">Quantidade de consultas confirmadas e pendentes de pagamento.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-3 text-center">
            <p className="text-2xl font-bold text-emerald-900">{confirmedCount}</p>
            <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-800">Consultas confirmadas</p>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-3 text-center">
            <p className="text-2xl font-bold text-amber-900">{pendingPaymentCount}</p>
            <p className="text-[11px] font-medium uppercase tracking-wide text-amber-800">Pagamentos pendentes</p>
          </div>
        </div>
      </section>

      {loadError ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{loadError}</section>
      ) : null}

      <section className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5 sm:p-6" id="privacidade-discreta">
        <h2 className="text-base font-semibold text-indigo-950">Privacidade e acolhimento</h2>
        <p className="mt-2 text-sm leading-relaxed text-indigo-950/85">
          Este portal foi pensado para você se sentir acolhido(a), com linguagem clara e sem pressa. O conteúdo clínico sensível
          continua restrito à sessão com o profissional; aqui ficam só organização, finanças e comunicações administrativas.
        </p>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-6">
        <button
          type="button"
          onClick={logout}
          className="rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Sair do portal
        </button>
        <p className="text-xs text-slate-500">Dúvidas? Use suporte no rodapé da página.</p>
      </div>
    </div>
  );
}
