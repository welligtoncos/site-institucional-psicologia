"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";

const ACCESS_TOKEN_KEY = "portal_access_token";
const REFRESH_TOKEN_KEY = "portal_refresh_token";

type MeResponse = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: "patient" | "psychologist" | "admin";
  is_active: boolean;
  terms_accepted_at?: string | null;
  created_at: string;
  detail?: string;
};

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  detail?: string;
};

type Appointment = {
  id: string;
  psychologist: string;
  date: string;
  time: string;
  modality: "Online" | "Presencial";
  status: "Agendada" | "Confirmada" | "Realizada" | "Cancelada" | "Pendente";
  payment: "Pago" | "Pendente";
  price: number;
};

const APPOINTMENTS: Appointment[] = [
  {
    id: "ap-1",
    psychologist: "Dra. Ana Souza",
    date: "20/04/2026",
    time: "14:00",
    modality: "Online",
    status: "Confirmada",
    payment: "Pago",
    price: 190,
  },
  {
    id: "ap-2",
    psychologist: "Dr. Rafael Souza",
    date: "12/04/2026",
    time: "10:30",
    modality: "Online",
    status: "Realizada",
    payment: "Pago",
    price: 210,
  },
  {
    id: "ap-3",
    psychologist: "Dra. Beatriz Lima",
    date: "23/04/2026",
    time: "19:00",
    modality: "Presencial",
    status: "Pendente",
    payment: "Pendente",
    price: 240,
  },
];

type PortalGateProps = {
  children?: ReactNode;
};

export function PortalGate({ children }: PortalGateProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [appointments] = useState<Appointment[]>(APPOINTMENTS);

  useEffect(() => {
    let mounted = true;

    async function fetchMeWithToken(accessToken: string) {
      const response = await fetch("/api/portal/me", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const data = (await response.json()) as MeResponse;
      return { response, data };
    }

    async function refreshSession(refreshToken: string) {
      const response = await fetch("/api/portal/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      const data = (await response.json()) as TokenResponse;
      return { response, data };
    }

    async function validateSession() {
      const accessToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
      const refreshToken = window.localStorage.getItem(REFRESH_TOKEN_KEY);

      if (!accessToken) {
        router.push("/login?next=/portal");
        return;
      }

      const meAttempt = await fetchMeWithToken(accessToken);
      if (meAttempt.response.ok) {
        if (meAttempt.data.role !== "patient") {
          router.replace("/psicologo");
          return;
        }
        if (!mounted) return;
        setUserName(meAttempt.data.name);
        setUserEmail(meAttempt.data.email);
        setLoading(false);
        return;
      }

      if (!refreshToken) {
        window.localStorage.removeItem(ACCESS_TOKEN_KEY);
        router.push("/login?next=/portal");
        return;
      }

      const refreshAttempt = await refreshSession(refreshToken);
      if (
        !refreshAttempt.response.ok ||
        !refreshAttempt.data.access_token ||
        !refreshAttempt.data.refresh_token
      ) {
        window.localStorage.removeItem(ACCESS_TOKEN_KEY);
        window.localStorage.removeItem(REFRESH_TOKEN_KEY);
        router.push("/login?next=/portal");
        return;
      }

      window.localStorage.setItem(ACCESS_TOKEN_KEY, refreshAttempt.data.access_token);
      window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshAttempt.data.refresh_token);

      const retriedMe = await fetchMeWithToken(refreshAttempt.data.access_token);
      if (!retriedMe.response.ok) {
        if (!mounted) return;
        setErrorMessage(retriedMe.data.detail || "Nao foi possivel validar a sessao.");
        setLoading(false);
        return;
      }

      if (retriedMe.data.role !== "patient") {
        router.replace("/psicologo");
        return;
      }

      if (!mounted) return;
      setUserName(retriedMe.data.name);
      setUserEmail(retriedMe.data.email);
      setLoading(false);
    }

    validateSession().catch((error) => {
      if (!mounted) return;
      setErrorMessage(error instanceof Error ? error.message : "Erro ao carregar portal.");
      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [router]);

  function handleLogout() {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    router.push("/login?next=/portal");
  }

  const nextConsultation = useMemo(
    () => appointments.find((item) => item.status === "Confirmada" || item.status === "Agendada") ?? null,
    [appointments],
  );
  const completedConsultations = useMemo(
    () => appointments.filter((item) => item.status === "Realizada"),
    [appointments],
  );
  const pendingPayments = useMemo(
    () => appointments.filter((item) => item.payment === "Pendente").length,
    [appointments],
  );

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <p className="text-sm text-slate-600">Validando sessao...</p>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="space-y-4 rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
        <p className="text-sm text-rose-700">{errorMessage}</p>
        <Link
          href="/login?next=/portal"
          className="inline-flex rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
        >
          Voltar para login
        </Link>
      </div>
    );
  }

  if (children != null) {
    return <>{children}</>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-sky-100 bg-gradient-to-r from-sky-50 to-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">Bem-vindo, {userName}.</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Dashboard do paciente</h1>
        <p className="mt-2 text-sm text-slate-600">
          Simples, seguro e focado no que importa: proxima consulta, historico, agendamento, pagamentos e documentos.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.08em] text-slate-500">Proxima consulta</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {nextConsultation ? `${nextConsultation.date} - ${nextConsultation.time}` : "Sem agendamento"}
          </p>
          <p className="mt-1 text-xs text-slate-600">{nextConsultation?.psychologist || "-"}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.08em] text-slate-500">Status atual</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{nextConsultation?.status || "Sem status"}</p>
          <p className="mt-1 text-xs text-slate-600">{nextConsultation?.modality || "-"}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.08em] text-slate-500">Pagamento</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {nextConsultation ? `R$ ${nextConsultation.price.toFixed(2).replace(".", ",")}` : "-"}
          </p>
          <p className="mt-1 text-xs text-slate-600">{pendingPayments} pendente(s)</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.08em] text-slate-500">Historico resumido</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{completedConsultations.length} realizadas</p>
          <Link href="/portal/consultas" className="mt-2 inline-flex text-xs font-semibold text-sky-700">
            Ver historico completo
          </Link>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Detalhes da proxima consulta</p>
          {nextConsultation ? (
            <div className="mt-3 space-y-3">
              <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                <p>
                  <span className="font-semibold text-slate-900">Psicologo:</span> {nextConsultation.psychologist}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">Data:</span> {nextConsultation.date}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">Horario:</span> {nextConsultation.time}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">Status:</span> {nextConsultation.status}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">Modalidade:</span> {nextConsultation.modality}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">Valor:</span> R${" "}
                  {nextConsultation.price.toFixed(2).replace(".", ",")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {nextConsultation.modality === "Online" ? (
                  <button
                    type="button"
                    className="rounded-full border border-sky-300 bg-sky-50 px-4 py-2 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
                  >
                    Entrar na consulta
                  </button>
                ) : null}
                <Link
                  href="/portal/agendar"
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Agendar nova consulta
                </Link>
                <Link
                  href="/portal/consultas"
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Ver historico
                </Link>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600">Sem consulta proxima no momento.</p>
          )}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Agendamento rapido</p>
          <div className="mt-3 space-y-2">
            <Link
              href="/portal/agendar"
              className="block rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Agendar nova consulta
            </Link>
            <button
              type="button"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Reagendar consulta
            </button>
            <button
              type="button"
              className="w-full rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-left text-sm font-medium text-rose-700 transition hover:bg-rose-100"
            >
              Cancelar consulta
            </button>
          </div>
        </article>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Lembretes e avisos</p>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <p className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              Consulta proxima confirmada para {nextConsultation?.date || "-"}.
            </p>
            <p className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              Qualquer alteracao de horario aparecera aqui.
            </p>
            <p className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              Mensagens importantes da clinica ficam nesta area.
            </p>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Documentos</p>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <button
              type="button"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-left transition hover:bg-slate-100"
            >
              Baixar recibo/comprovante
            </button>
            <button
              type="button"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-left transition hover:bg-slate-100"
            >
              Solicitar declaracao de comparecimento
            </button>
            <button
              type="button"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-left transition hover:bg-slate-100"
            >
              Ver orientacoes e anexos
            </button>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Perfil</p>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <p className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              Nome: <span className="font-medium text-slate-900">{userName}</span>
            </p>
            <p className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              Contato: <span className="font-medium text-slate-900">{userEmail || "nao informado"}</span>
            </p>
            <button
              type="button"
              className="w-full rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Atualizar dados
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Sair
            </button>
          </div>
        </article>
      </section>
    </div>
  );
}
