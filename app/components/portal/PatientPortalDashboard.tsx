"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { usePortalPatientSession } from "@/app/components/auth/PortalGate";
import {
  formatAppointmentDatePt,
  isAppointmentHistory,
  isAppointmentUpcoming,
  portalAppointmentStart,
  type MockAppointment,
} from "@/app/lib/portal-mocks";
import { getAllPaymentCharges, getPatientAppointments } from "@/app/lib/portal-payment-mock";
import { siteConfig } from "@/app/lib/site";

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function statusPt(a: MockAppointment): string {
  const map: Record<MockAppointment["status"], string> = {
    agendada: "Agendada",
    confirmada: "Confirmada",
    em_andamento: "Em andamento",
    realizada: "Realizada",
    cancelada: "Cancelada",
    nao_compareceu: "Não compareceu",
  };
  return map[a.status];
}

export function PatientPortalDashboard() {
  const { userName, userEmail, logout } = usePortalPatientSession();
  const [rows, setRows] = useState<MockAppointment[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const reload = useCallback(() => {
    setRows(getPatientAppointments());
  }, []);

  useEffect(() => {
    reload();
    setHydrated(true);
    function onBilling() {
      reload();
    }
    window.addEventListener("portal-billing-changed", onBilling);
    window.addEventListener("storage", onBilling);
    return () => {
      window.removeEventListener("portal-billing-changed", onBilling);
      window.removeEventListener("storage", onBilling);
    };
  }, [reload]);

  const upcoming = useMemo(() => {
    return rows
      .filter(isAppointmentUpcoming)
      .sort((a, b) => portalAppointmentStart(a.isoDate, a.time).getTime() - portalAppointmentStart(b.isoDate, b.time).getTime());
  }, [rows]);

  const history = useMemo(() => rows.filter(isAppointmentHistory), [rows]);

  const next = upcoming[0] ?? null;

  const charges = useMemo(() => (hydrated ? getAllPaymentCharges() : []), [hydrated, rows]);

  const pendingCharges = useMemo(() => charges.filter((c) => c.gatewayStatus === "awaiting_payment"), [charges]);
  const paidCharges = useMemo(() => charges.filter((c) => c.gatewayStatus === "succeeded"), [charges]);

  const cancelledOrRescheduled = useMemo(
    () => rows.filter((a) => a.status === "cancelada" || a.status === "nao_compareceu"),
    [rows],
  );

  const historyPreview = useMemo(() => {
    return [...history].sort(
      (a, b) => portalAppointmentStart(b.isoDate, b.time).getTime() - portalAppointmentStart(a.isoDate, a.time).getTime(),
    );
  }, [history]);

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
    if (next.status === "agendada") {
      return {
        label: "Confirmar consulta",
        href: "/portal/consultas",
        tone: "sky" as const,
        sub: "Revise dados e confirme na área de consultas.",
      };
    }
    if (next.format === "Online" && (next.status === "confirmada" || next.status === "em_andamento")) {
      return {
        label: "Entrar no atendimento online",
        href: "/portal/atendimento",
        tone: "emerald" as const,
        sub: "Sala de espera e link da videochamada quando o psicólogo enviar.",
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
      {/* Topo: acolhimento + resumo + CTA */}
      <section className="overflow-hidden rounded-2xl border border-sky-100/80 bg-gradient-to-br from-sky-50 via-white to-indigo-50/40 p-6 shadow-sm sm:p-8">
        <p className="text-sm font-medium text-sky-900/90">
          Olá, <span className="font-semibold text-slate-900">{firstName}</span> — este espaço é só seu. Aqui você acompanha consultas,
          valores e avisos com discrição.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-slate-600">
          Seus dados de saúde mental são tratados com sigilo. Em dúvida, fale com a recepção pelos canais no final da página.
        </p>

        <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-stretch lg:justify-between">
          <div className="min-w-0 flex-1 rounded-2xl border border-white/80 bg-white/90 p-5 shadow-sm backdrop-blur-sm">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-sky-800">Próxima consulta</p>
            {next ? (
              <>
                <p className="mt-2 text-lg font-semibold tracking-tight text-slate-900">
                  {formatAppointmentDatePt(next.isoDate)} às {next.time}
                </p>
                <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
                  <li>
                    <span className="text-slate-500">Psicólogo(a):</span>{" "}
                    <span className="font-medium text-slate-900">{next.psychologist}</span>
                  </li>
                  <li>
                    <span className="text-slate-500">Modalidade:</span>{" "}
                    <span className="font-medium text-slate-900">{next.format}</span>
                  </li>
                  <li>
                    <span className="text-slate-500">Status:</span>{" "}
                    <span className="font-medium text-slate-900">{statusPt(next)}</span>
                    {" · "}
                    <span className="text-slate-500">Pagamento:</span>{" "}
                    <span className={next.payment === "Pendente" ? "font-semibold text-amber-800" : "font-medium text-emerald-800"}>
                      {next.payment}
                    </span>
                  </li>
                  <li>
                    <span className="text-slate-500">Valor da sessão:</span>{" "}
                    <span className="font-medium text-slate-900">{formatBRL(next.price)}</span>
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
                href="/portal/consultas"
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Reagendar
              </Link>
              <Link
                href="/portal/agendar"
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Nova consulta
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

      {/* Atendimento online rápido */}
      <section id="teleatendimento" className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Atendimento online</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
              No dia da sessão online, use <strong className="font-medium text-slate-800">Entrar no atendimento online</strong> acima
              (ou o menu) para abrir a sala de espera. O link da Meet ou Zoom aparece quando o psicólogo enviar; o cronômetro só
              começa quando a sessão for iniciada no painel dele(a).
            </p>
            <ul className="mt-3 list-inside list-disc text-xs text-slate-600">
              <li>Entre alguns minutos antes, em lugar calmo e com internet estável.</li>
              <li>Use fones, se puder, para melhor privacidade e áudio.</li>
            </ul>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:items-end">
            <Link
              href="/portal/atendimento"
              className="inline-flex rounded-full bg-emerald-700 px-4 py-2.5 text-center text-xs font-semibold text-white hover:bg-emerald-800"
            >
              Ir para sala de espera
            </Link>
            <a
              href="https://meet.google.com/landing"
              target="_blank"
              rel="noopener noreferrer"
              className="text-center text-xs font-semibold text-emerald-900 underline hover:text-emerald-950 sm:text-right"
            >
              Testar câmera e microfone (Google)
            </a>
          </div>
        </div>
        {next?.format === "Online" && next.videoCallLink ? (
          <p className="mt-4 rounded-lg border border-emerald-200/80 bg-white/80 px-3 py-2 text-xs text-slate-700">
            <span className="font-semibold text-slate-800">Link de apoio da consulta:</span>{" "}
            <a href={next.videoCallLink} className="break-all text-emerald-800 underline" target="_blank" rel="noopener noreferrer">
              {next.videoCallLink}
            </a>{" "}
            <span className="text-slate-500">(exemplo no cadastro; o link oficial segue o fluxo do atendimento ao vivo.)</span>
          </p>
        ) : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Minhas consultas */}
        <section id="consultas" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Minhas consultas</h2>
              <p className="mt-1 text-sm text-slate-600">Futuras, histórico e alterações — tudo em um só lugar.</p>
            </div>
            <Link href="/portal/consultas" className="shrink-0 text-sm font-semibold text-sky-700 underline hover:text-sky-900">
              Abrir tudo
            </Link>
          </div>
          {!hydrated ? (
            <p className="mt-4 text-sm text-slate-500">Carregando…</p>
          ) : (
            <>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-sky-100 bg-sky-50/60 px-3 py-3 text-center">
                  <p className="text-2xl font-bold text-sky-900">{upcoming.length}</p>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-sky-800">Futuras</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-center">
                  <p className="text-2xl font-bold text-slate-800">{history.length}</p>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-600">Histórico</p>
                </div>
                <div className="rounded-xl border border-rose-100 bg-rose-50/60 px-3 py-3 text-center">
                  <p className="text-2xl font-bold text-rose-900">{cancelledOrRescheduled.length}</p>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-rose-800">Canceladas / faltas</p>
                </div>
              </div>
              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Últimas no histórico</p>
                <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-100">
                  {historyPreview.slice(0, 4).map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
                      <span className="font-medium text-slate-800">
                        {formatAppointmentDatePt(a.isoDate)} · {a.time}
                      </span>
                      <span className="text-xs text-slate-600">{statusPt(a)}</span>
                    </li>
                  ))}
                  {historyPreview.length === 0 ? (
                    <li className="px-3 py-4 text-sm text-slate-500">Nenhum registro no histórico ainda.</li>
                  ) : null}
                </ul>
              </div>
            </>
          )}
        </section>

        {/* Financeiro */}
        <section id="financeiro" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Financeiro</h2>
              <p className="mt-1 text-sm text-slate-600">Pagamentos, pendências e comprovantes (demonstração).</p>
            </div>
            <Link href="/portal/faturamento" className="shrink-0 text-sm font-semibold text-sky-700 underline hover:text-sky-900">
              Faturamento
            </Link>
          </div>
          <ul className="mt-4 space-y-2 text-sm text-slate-700">
            <li className="flex justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
              <span>Pagamentos concluídos</span>
              <span className="font-semibold text-emerald-800">{paidCharges.length}</span>
            </li>
            <li className="flex justify-between gap-2 rounded-lg bg-amber-50/80 px-3 py-2">
              <span>Pendências</span>
              <span className="font-semibold text-amber-900">{pendingCharges.length}</span>
            </li>
            <li className="flex justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
              <span>Próxima sessão (valor)</span>
              <span className="font-semibold text-slate-900">{next ? formatBRL(next.price) : "—"}</span>
            </li>
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-slate-500">
            Recibos e notas ficam em Faturamento. Em produção, o pagamento seguirá o gateway escolhido pela clínica.
          </p>
        </section>

        <section id="cadastro" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:col-span-2">
          <h2 className="text-base font-semibold text-slate-900">Meu cadastro</h2>
          <p className="mt-1 text-sm text-slate-600">Telefone, e-mail, contato de emergência e convênio (quando houver).</p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <dt className="text-xs text-slate-500">E-mail</dt>
              <dd className="font-medium text-slate-900">{userEmail || "—"}</dd>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <dt className="text-xs text-slate-500">Convênio (demo)</dt>
              <dd className="font-medium text-slate-900">Particular</dd>
            </div>
          </dl>
          <Link
            href="/portal/perfil"
            className="mt-4 inline-flex rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Atualizar meus dados
          </Link>
        </section>
      </div>

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
