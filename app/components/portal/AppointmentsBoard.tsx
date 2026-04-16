"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type AppointmentStatus =
  | "agendada"
  | "confirmada"
  | "realizada"
  | "cancelada"
  | "reagendada"
  | "pendente_confirmacao";

type AppointmentTab = "proximas" | "historico" | "canceladas";

type AppointmentItem = {
  id: string;
  psychologist: string;
  specialty: string;
  date: string;
  time: string;
  format: "Online" | "Presencial";
  status: AppointmentStatus;
  payment: "Pago" | "Pendente";
  price: number;
  duration: string;
  tab: AppointmentTab;
  reminder: string;
  videoCallLink?: string;
  preSessionGuidance: string;
  adminNotes: string;
};

const APPOINTMENTS: AppointmentItem[] = [
  {
    id: "c1",
    psychologist: "Dra. Ana Souza",
    specialty: "Ansiedade e estresse",
    date: "20/04/2026",
    time: "14:00",
    format: "Online",
    status: "confirmada",
    payment: "Pago",
    price: 190,
    duration: "50 min",
    tab: "proximas",
    reminder: "Lembrete ativo: 2h antes da consulta.",
    videoCallLink: "https://meet.exemplo.com/consulta-c1",
    preSessionGuidance: "Entrar 10 minutos antes e estar em local silencioso.",
    adminNotes: "Documento de consentimento enviado por e-mail.",
  },
  {
    id: "c2",
    psychologist: "Dra. Beatriz Lima",
    specialty: "Terapia de casal",
    date: "23/04/2026",
    time: "19:00",
    format: "Presencial",
    status: "pendente_confirmacao",
    payment: "Pendente",
    price: 240,
    duration: "60 min",
    tab: "proximas",
    reminder: "Lembrete sera enviado apos confirmacao.",
    preSessionGuidance: "Chegar 15 minutos antes para recepcao.",
    adminNotes: "Aguardando confirmacao da agenda da profissional.",
  },
  {
    id: "c3",
    psychologist: "Dr. Rafael Souza",
    specialty: "Depressao e luto",
    date: "05/04/2026",
    time: "10:30",
    format: "Online",
    status: "realizada",
    payment: "Pago",
    price: 210,
    duration: "50 min",
    tab: "historico",
    reminder: "Consulta concluida.",
    videoCallLink: "https://meet.exemplo.com/consulta-c3",
    preSessionGuidance: "Teste audio e camera antes da sessao.",
    adminNotes: "Sessao concluida com orientacao de exercicio de respiracao.",
  },
  {
    id: "c4",
    psychologist: "Dra. Ana Souza",
    specialty: "Ansiedade e estresse",
    date: "12/04/2026",
    time: "14:00",
    format: "Online",
    status: "reagendada",
    payment: "Pago",
    price: 190,
    duration: "50 min",
    tab: "proximas",
    reminder: "Lembrete ativo para o novo horario.",
    videoCallLink: "https://meet.exemplo.com/consulta-c4",
    preSessionGuidance: "Entrar com 5 minutos de antecedencia.",
    adminNotes: "Horario reagendado a pedido do paciente.",
  },
  {
    id: "c5",
    psychologist: "Dra. Beatriz Lima",
    specialty: "Terapia de casal",
    date: "30/03/2026",
    time: "18:00",
    format: "Presencial",
    status: "cancelada",
    payment: "Pendente",
    price: 240,
    duration: "60 min",
    tab: "canceladas",
    reminder: "Consulta cancelada.",
    preSessionGuidance: "Sem orientacoes.",
    adminNotes: "Cancelada por indisponibilidade do paciente.",
  },
  {
    id: "c6",
    psychologist: "Dr. Rafael Souza",
    specialty: "Depressao e luto",
    date: "15/04/2026",
    time: "09:00",
    format: "Online",
    status: "agendada",
    payment: "Pago",
    price: 210,
    duration: "50 min",
    tab: "proximas",
    reminder: "Lembrete ativo: 24h antes da consulta.",
    videoCallLink: "https://meet.exemplo.com/consulta-c6",
    preSessionGuidance: "Ambiente sem interrupcoes.",
    adminNotes: "Consulta agendada com confirmacao automatica pendente.",
  },
];

function statusPillClass(status: AppointmentStatus) {
  if (status === "confirmada" || status === "realizada") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "pendente_confirmacao") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "cancelada") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "reagendada") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

function statusLabel(status: AppointmentStatus) {
  if (status === "pendente_confirmacao") return "Pendente de confirmacao";
  if (status === "agendada") return "Agendada";
  if (status === "confirmada") return "Confirmada";
  if (status === "realizada") return "Realizada";
  if (status === "cancelada") return "Cancelada";
  return "Reagendada";
}

export function AppointmentsBoard() {
  const [tab, setTab] = useState<AppointmentTab>("proximas");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const visibleAppointments = useMemo(
    () => APPOINTMENTS.filter((appointment) => appointment.tab === tab),
    [tab],
  );

  const completedSummary = useMemo(() => {
    const completed = APPOINTMENTS.filter((item) => item.status === "realizada");
    const professionals = Array.from(new Set(completed.map((item) => item.psychologist)));
    return {
      totalCompleted: completed.length,
      professionals,
    };
  }, []);

  const pendingPayments = useMemo(
    () => APPOINTMENTS.filter((item) => item.payment === "Pendente").length,
    [],
  );

  const latestCompleted = useMemo(
    () => APPOINTMENTS.find((item) => item.status === "realizada") ?? null,
    [],
  );

  const nextConsultation = useMemo(
    () => APPOINTMENTS.find((item) => item.tab === "proximas" && item.status !== "cancelada") ?? null,
    [],
  );

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-sky-100 bg-gradient-to-r from-sky-50 to-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Minhas consultas</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Tudo simples, seguro e claro</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Aqui voce acompanha suas consultas, acessa a sessao online, recebe lembretes e resolve reagendamento,
          cancelamento e pagamento com poucos cliques.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.08em] text-slate-500">Consultas realizadas</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{completedSummary.totalCompleted}</p>
          <p className="mt-1 text-xs text-slate-600">
            {completedSummary.professionals.length > 0
              ? `Com: ${completedSummary.professionals.join(", ")}`
              : "Sem historico ainda."}
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.08em] text-slate-500">Pagamentos pendentes</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{pendingPayments}</p>
          <p className="mt-1 text-xs text-slate-600">Visualize valor e comprovante quando disponivel.</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.08em] text-slate-500">Privacidade</p>
          <p className="mt-1 text-sm font-medium text-slate-900">Dados protegidos</p>
          <p className="mt-1 text-xs text-slate-600">Informacoes pessoais e de saude em ambiente seguro.</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.08em] text-slate-500">Agendamento</p>
          <Link
            href="/portal/agendar"
            className="mt-2 inline-flex rounded-full bg-sky-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-sky-700"
          >
            Agendar consulta
          </Link>
        </article>
      </section>

      {latestCompleted ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
            Consulta realizada com sucesso
          </p>
          <div className="mt-3 grid gap-3 text-sm text-slate-700 md:grid-cols-2 lg:grid-cols-5">
            <p>
              <span className="font-semibold text-slate-900">Psicologo:</span> {latestCompleted.psychologist}
            </p>
            <p>
              <span className="font-semibold text-slate-900">Data:</span> {latestCompleted.date}
            </p>
            <p>
              <span className="font-semibold text-slate-900">Horario:</span> {latestCompleted.time}
            </p>
            <p>
              <span className="font-semibold text-slate-900">Status:</span> {statusLabel(latestCompleted.status)}
            </p>
            <p>
              <span className="font-semibold text-slate-900">Valor pago:</span> R${" "}
              {latestCompleted.price.toFixed(2).replace(".", ",")}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/portal/agendar"
              className="rounded-full bg-sky-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-sky-700"
            >
              Agendar nova consulta
            </Link>
            <button
              type="button"
              onClick={() => setTab("historico")}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Ver historico
            </button>
            <button
              type="button"
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Baixar recibo
            </button>
            <button
              type="button"
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Solicitar declaracao
            </button>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">Proximo passo</p>
          {nextConsultation ? (
            <div className="mt-2 text-sm text-slate-700">
              <p>
                Proxima consulta: <span className="font-semibold text-slate-900">{nextConsultation.date}</span> as{" "}
                <span className="font-semibold text-slate-900">{nextConsultation.time}</span> com{" "}
                <span className="font-semibold text-slate-900">{nextConsultation.psychologist}</span>.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-full border border-sky-300 bg-sky-50 px-4 py-2 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
                >
                  Confirmar atendimento
                </button>
                <button
                  type="button"
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Remarcar
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-600">Nenhuma consulta futura no momento.</p>
          )}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">Avaliacao da experiencia</p>
          <p className="mt-2 text-sm text-slate-600">Como foi sua experiencia na ultima sessao?</p>
          <div className="mt-3 flex gap-2">
            {[1, 2, 3, 4, 5].map((score) => (
              <button
                key={score}
                type="button"
                className="h-8 w-8 rounded-full border border-slate-300 bg-white text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                {score}
              </button>
            ))}
          </div>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {[
            { id: "proximas", label: "Proximas consultas" },
            { id: "historico", label: "Historico" },
            { id: "canceladas", label: "Canceladas" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id as AppointmentTab)}
              className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] transition ${
                tab === item.id
                  ? "border-sky-300 bg-sky-50 text-sky-800"
                  : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        {visibleAppointments.map((appointment) => (
          <article key={appointment.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{appointment.psychologist}</h2>
                <p className="text-sm text-slate-600">{appointment.specialty}</p>
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] ${statusPillClass(appointment.status)}`}
              >
                {statusLabel(appointment.status)}
              </span>
            </div>

            <dl className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <dt className="text-xs uppercase tracking-[0.08em] text-slate-500">Data</dt>
                <dd className="mt-1 font-medium text-slate-900">{appointment.date}</dd>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <dt className="text-xs uppercase tracking-[0.08em] text-slate-500">Horario</dt>
                <dd className="mt-1 font-medium text-slate-900">{appointment.time}</dd>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <dt className="text-xs uppercase tracking-[0.08em] text-slate-500">Modalidade</dt>
                <dd className="mt-1 font-medium text-slate-900">{appointment.format}</dd>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <dt className="text-xs uppercase tracking-[0.08em] text-slate-500">Pagamento</dt>
                <dd className={`mt-1 font-medium ${appointment.payment === "Pago" ? "text-emerald-700" : "text-amber-700"}`}>
                  {appointment.payment}
                </dd>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <dt className="text-xs uppercase tracking-[0.08em] text-slate-500">Valor</dt>
                <dd className="mt-1 font-medium text-slate-900">R$ {appointment.price.toFixed(2).replace(".", ",")}</dd>
              </div>
            </dl>

            <p className="mt-3 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-700">
              {appointment.reminder}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setExpandedId((previous) => (previous === appointment.id ? null : appointment.id))}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Ver detalhes
              </button>

              {appointment.format === "Online" ? (
                <button
                  type="button"
                  className="rounded-full border border-sky-300 bg-sky-50 px-4 py-2 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
                >
                  Entrar na consulta
                </button>
              ) : null}

              <button
                type="button"
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Remarcar consulta
              </button>
              <button
                type="button"
                className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
              >
                Cancelar consulta
              </button>
              <button
                type="button"
                className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
              >
                Confirmar presenca
              </button>
              <button
                type="button"
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Visualizar historico
              </button>
              <button
                type="button"
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Baixar recibo
              </button>
              <button
                type="button"
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Enviar mensagem
              </button>
            </div>

            {expandedId === appointment.id ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-semibold text-slate-900">Detalhes da consulta</h3>
                <dl className="mt-3 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
                  <div>
                    <dt className="text-xs uppercase tracking-[0.08em] text-slate-500">Link da videochamada</dt>
                    <dd className="mt-1 font-medium text-sky-700">
                      {appointment.videoCallLink ? appointment.videoCallLink : "Nao se aplica para presencial"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.08em] text-slate-500">Duracao</dt>
                    <dd className="mt-1 font-medium text-slate-900">{appointment.duration}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.08em] text-slate-500">Orientacoes antes da sessao</dt>
                    <dd className="mt-1 font-medium text-slate-900">{appointment.preSessionGuidance}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.08em] text-slate-500">Observacoes administrativas</dt>
                    <dd className="mt-1 font-medium text-slate-900">{appointment.adminNotes}</dd>
                  </div>
                </dl>
              </div>
            ) : null}
          </article>
        ))}

        {visibleAppointments.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
            Nenhuma consulta encontrada nesta aba.
          </p>
        ) : null}
      </section>
    </div>
  );
}
