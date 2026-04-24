"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { MercadoPagoCheckout } from "@/app/components/payments/MercadoPagoCheckout";
import { formatApiErrorDetail } from "@/app/lib/portal-errors";
import {
  createPatientAppointment,
  listPatientAppointments,
  type ApiPatientChargeSummary,
} from "@/app/lib/portal-appointments-api";
import { readPortalPatientSnapshot, savePortalPatientSnapshot } from "@/app/lib/portal-patient-snapshot";

const ACCESS_TOKEN_KEY = "portal_access_token";

const AVATAR_GRADIENTS = [
  "from-violet-500 to-fuchsia-600",
  "from-sky-500 to-indigo-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
];

function gradientForId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h + id.charCodeAt(i)) % 997;
  }
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length] ?? AVATAR_GRADIENTS[0];
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const a = parts[0][0];
  const b = parts[parts.length - 1][0];
  if (!a || !b) return "?";
  return (a + b).toUpperCase();
}

function formatShortDatePt(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function formatLongDatePt(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatClockPt(hhmm: string): string {
  const [hs, ms] = hhmm.split(":");
  const h = Number(hs);
  const m = Number(ms);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

type WeeklyTemplateRow = {
  weekday: number;
  weekday_label: string;
  ativo: boolean;
  start: string;
  end: string;
};

type BookableDay = { date: string; weekday?: number; weekday_label?: string; slots: string[] };

function normalizeDayKey(raw: string): string {
  if (raw.length >= 10 && raw[4] === "-" && raw[7] === "-") {
    return raw.slice(0, 10);
  }
  return raw;
}

type BookablePayload = {
  id: string;
  nome: string;
  crp: string;
  valor_consulta: string;
  duracao_minutos: number;
  especialidades: string[];
  weekly_template?: WeeklyTemplateRow[];
  days: BookableDay[];
};

type CatalogItem = {
  id: string;
  nome: string;
  crp: string;
  bio: string;
  valor_consulta: string;
  duracao_minutos: number;
  foto_url: string | null;
  especialidades: string[];
};

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function formatBrl(value: string): string {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function StepBadge({ n, state }: { n: number; state: "pending" | "current" | "complete" }) {
  const cls =
    state === "current"
      ? "bg-sky-600 text-white shadow-sm ring-2 ring-sky-200"
      : state === "complete"
        ? "bg-emerald-500 text-white"
        : "bg-slate-100 text-slate-400";
  return (
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${cls}`} aria-hidden>
      {state === "complete" ? "✓" : n}
    </span>
  );
}

export function ScheduleConsultationBoard() {
  const searchParams = useSearchParams();
  const psychId = searchParams.get("psych")?.trim() ?? "";

  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [searchText, setSearchText] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState("all");

  const [bookable, setBookable] = useState<BookablePayload | null>(null);
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [loadMessage, setLoadMessage] = useState("");

  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastCharge, setLastCharge] = useState<ApiPatientChargeSummary | null>(null);
  const [lastAppointmentId, setLastAppointmentId] = useState<string | null>(null);
  const [patientDisplayName, setPatientDisplayName] = useState("");

  const availableSpecialties = useMemo(() => {
    const values = new Set<string>();
    for (const p of catalog) {
      for (const s of p.especialidades ?? []) {
        const normalized = s.trim();
        if (normalized) values.add(normalized);
      }
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [catalog]);

  const visibleCatalog = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return catalog.filter((p) => {
      const matchesText =
        q.length === 0 ||
        p.nome.toLowerCase().includes(q) ||
        p.crp.toLowerCase().includes(q) ||
        (p.especialidades ?? []).some((s) => s.toLowerCase().includes(q));
      const matchesSpecialty =
        specialtyFilter === "all" || (p.especialidades ?? []).some((s) => s === specialtyFilter);
      return matchesText && matchesSpecialty;
    });
  }, [catalog, searchText, specialtyFilter]);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError("");
    const token = typeof window !== "undefined" ? window.localStorage.getItem(ACCESS_TOKEN_KEY) : null;
    if (!token) {
      setCatalog([]);
      setCatalogLoading(false);
      setCatalogError("Sua sessão expirou. Faça login novamente.");
      return;
    }

    const response = await fetch("/api/portal/psychologists?limit=50", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const data = (await response.json().catch(() => null)) as CatalogItem[] | { detail?: unknown };
    if (!response.ok) {
      setCatalog([]);
      setCatalogLoading(false);
      setCatalogError(formatApiErrorDetail(data, "Não foi possível carregar os profissionais."));
      return;
    }
    if (!Array.isArray(data)) {
      setCatalog([]);
      setCatalogLoading(false);
      setCatalogError("Resposta inválida ao listar profissionais.");
      return;
    }
    setCatalog(data);
    setCatalogLoading(false);
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    const snap = readPortalPatientSnapshot();
    if (snap?.name?.trim()) {
      setPatientDisplayName(snap.name.trim());
      return;
    }
    const token = typeof window !== "undefined" ? window.localStorage.getItem(ACCESS_TOKEN_KEY) : null;
    if (!token) return;
    let cancelled = false;
    void fetch("/api/portal/me", { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => {
        const data = (await r.json().catch(() => null)) as { name?: string; email?: string } | null;
        if (!r.ok || !data || typeof data.name !== "string" || typeof data.email !== "string") return;
        savePortalPatientSnapshot({ name: data.name, email: data.email });
        if (!cancelled) setPatientDisplayName(data.name.trim());
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const loadBookable = useCallback(async () => {
    if (!psychId || !isUuidLike(psychId)) {
      setBookable(null);
      setLoadStatus(psychId ? "error" : "idle");
      setLoadMessage(
        psychId
          ? "Não encontramos esse profissional. Volte à lista e escolha novamente."
          : "Escolha um profissional na lista para ver os horários livres.",
      );
      return;
    }

    setLoadStatus("loading");
    setLoadMessage("");
    const token = typeof window !== "undefined" ? window.localStorage.getItem(ACCESS_TOKEN_KEY) : null;
    if (!token) {
      setLoadStatus("error");
      setLoadMessage("Sua sessão expirou. Entre de novo para continuar.");
      setBookable(null);
      return;
    }

    const response = await fetch(
      `/api/portal/bookable-slots?psychologist_id=${encodeURIComponent(psychId)}&days=7`,
      {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      },
    );
    const data = (await response.json().catch(() => null)) as BookablePayload | { detail?: unknown };

    if (!response.ok) {
      setLoadStatus("error");
      setLoadMessage(formatApiErrorDetail(data, "Não foi possível carregar os horários. Tente de novo em instantes."));
      setBookable(null);
      return;
    }

    if (!data || typeof data !== "object" || !("days" in data) || !Array.isArray((data as BookablePayload).days)) {
      setLoadStatus("error");
      setLoadMessage("Não conseguimos carregar esta página. Atualize ou tente mais tarde.");
      setBookable(null);
      return;
    }

    const payload = data as BookablePayload;
    const normalized: BookablePayload = {
      ...payload,
      weekly_template: Array.isArray(payload.weekly_template) ? payload.weekly_template : [],
      days: payload.days.map((d) => ({
        ...d,
        date: normalizeDayKey(String(d.date)),
      })),
    };
    setBookable(normalized);
    setLoadStatus("ready");
  }, [psychId]);

  useEffect(() => {
    void loadBookable();
  }, [loadBookable]);

  const refreshPaymentStatus = useCallback(async () => {
    if (!lastAppointmentId) return;
    const out = await listPatientAppointments();
    if (!out.ok) return;
    const apt = out.data.appointments.find((a) => a.id === lastAppointmentId);
    if (apt?.payment === "Pago") {
      setLastCharge((c) => (c ? { ...c, gateway_status: "succeeded" } : c));
    }
  }, [lastAppointmentId]);

  useEffect(() => {
    if (!lastAppointmentId) return;
    const onRefresh = () => {
      void refreshPaymentStatus();
    };
    window.addEventListener("portal-billing-changed", onRefresh);
    window.addEventListener("focus", onRefresh);
    return () => {
      window.removeEventListener("portal-billing-changed", onRefresh);
      window.removeEventListener("focus", onRefresh);
    };
  }, [lastAppointmentId, refreshPaymentStatus]);

  const dateOptions = useMemo(() => {
    if (!bookable?.days?.length) return [];
    return bookable.days
      .filter((d) => d.slots.length > 0)
      .map((d) => normalizeDayKey(d.date))
      .slice(0, 7);
  }, [bookable]);

  useEffect(() => {
    if (!selectedDate && dateOptions.length > 0) {
      setSelectedDate(dateOptions[0]!);
    }
  }, [dateOptions, selectedDate]);

  useEffect(() => {
    const key = selectedDate ? normalizeDayKey(selectedDate) : "";
    if (key && !dateOptions.includes(key) && dateOptions.length > 0) {
      setSelectedDate(dateOptions[0]!);
      setSelectedTime("");
    }
  }, [dateOptions, selectedDate]);

  const slotsForDay = useMemo(() => {
    if (!bookable || !selectedDate) return [];
    const key = normalizeDayKey(selectedDate);
    const day = bookable.days.find((d) => normalizeDayKey(d.date) === key);
    return day?.slots ?? [];
  }, [bookable, selectedDate]);

  useEffect(() => {
    if (!selectedTime || slotsForDay.length === 0) return;
    if (!slotsForDay.includes(selectedTime)) {
      setSelectedTime("");
    }
  }, [selectedTime, slotsForDay]);

  const specialtyLabel = bookable?.especialidades?.[0] ?? "Consulta";

  function dayRowForIso(iso: string): BookableDay | undefined {
    if (!bookable) return undefined;
    const key = normalizeDayKey(iso);
    return bookable.days.find((d) => normalizeDayKey(d.date) === key);
  }

  async function handleConfirm() {
    if (!psychId || !bookable || !selectedDate || !selectedTime) {
      toast.error("Selecione um dia e um horário para continuar.");
      return;
    }
    setSubmitting(true);
    try {
      const snap = readPortalPatientSnapshot();
      const patientName = (patientDisplayName || snap?.name || "").trim();
      if (!patientName) {
        toast.error("Não foi possível identificar o paciente na sessão. Faça login novamente.");
        return;
      }
      const result = await createPatientAppointment({
        psychologist_id: psychId,
        iso_date: selectedDate,
        time: selectedTime,
        format: "Online",
      });
      if (!result.ok) {
        toast.error(result.detail);
        return;
      }
      setLastCharge(result.data.charge);
      setLastAppointmentId(result.data.appointment.id);
      await loadBookable();
      window.requestAnimationFrame(() => {
        document.getElementById("portal-schedule-payment")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      toast.success("Consulta reservada. Conclua o pagamento com o Mercado Pago abaixo para confirmar.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!psychId) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 pb-10">
        <header className="text-center sm:text-left">
          <p className="text-xs font-semibold uppercase tracking-widest text-sky-600">Agendamento</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Escolha uma profissional</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Pesquise por nome, CRP ou especialidade e selecione para ver os horários disponíveis.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-900/5">
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              type="search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Buscar profissional ou especialidade"
              className="sm:col-span-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            />
            <select
              value={specialtyFilter}
              onChange={(e) => setSpecialtyFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            >
              <option value="all">Todas especialidades</option>
              {availableSpecialties.map((spec) => (
                <option key={spec} value={spec}>
                  {spec}
                </option>
              ))}
            </select>
          </div>
          {catalogLoading ? (
            <p className="mt-4 text-sm text-slate-600">Carregando profissionais...</p>
          ) : catalogError ? (
            <div className="mt-4 space-y-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
              <p className="text-sm text-rose-800">{catalogError}</p>
              <button
                type="button"
                onClick={() => void loadCatalog()}
                className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
              >
                Tentar novamente
              </button>
            </div>
          ) : visibleCatalog.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">Nenhuma profissional encontrada com esse filtro.</p>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {visibleCatalog.map((p) => {
                const specs = p.especialidades?.length ? p.especialidades.join(" · ") : "Especialidades a definir";
                return (
                  <article key={p.id} className="rounded-xl border border-slate-200 bg-white p-3 transition hover:border-slate-300">
                    <div className="flex items-start gap-3">
                      {p.foto_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.foto_url} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                      ) : (
                        <div
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-xs font-bold text-white ${gradientForId(p.id)}`}
                          aria-hidden
                        >
                          {initialsFromName(p.nome)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{p.nome}</p>
                        <p className="text-xs text-sky-700">CRP {p.crp}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-slate-500">{specs}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-700">
                          R$ {formatBrl(p.valor_consulta)} · {p.duracao_minutos} min
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/portal/agendar?psych=${encodeURIComponent(p.id)}`}
                      className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-sky-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-sky-700"
                    >
                      Selecionar e agendar
                    </Link>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    );
  }

  if (loadStatus === "loading") {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
        <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-2 border-sky-200 border-t-sky-600" />
        <p className="text-sm font-medium text-slate-700">Carregando horários…</p>
        <p className="mt-1 text-xs text-slate-500">Só um instante</p>
      </div>
    );
  }

  if (loadStatus === "error" || !bookable) {
    return (
      <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-rose-100 bg-rose-50/90 p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-rose-950">Algo deu errado</h1>
        <p className="text-sm leading-relaxed text-rose-900/90">{loadMessage}</p>
        <Link
          href="/portal/agendar"
          className="inline-flex rounded-xl bg-white px-4 py-2 text-sm font-semibold text-sky-700 ring-1 ring-slate-200 hover:bg-slate-50"
        >
          Trocar profissional
        </Link>
      </div>
    );
  }

  const avatarClass = gradientForId(bookable.id);
  const initials = initialsFromName(bookable.nome);
  const hasRawSlotsFromApi = bookable.days.some((d) => d.slots.length > 0);
  const hasFreeSlotsAfterBookings = hasRawSlotsFromApi;
  const paymentComplete = lastCharge?.gateway_status === "succeeded";
  const awaitingPayment = lastCharge?.gateway_status === "awaiting_payment";
  const pickingSlots = !lastCharge;
  const priceFormatted = parseFloat(bookable.valor_consulta).toFixed(2).replace(".", ",");
  const step1Done = Boolean(selectedDate && dateOptions.includes(normalizeDayKey(selectedDate)));
  const step2Done = Boolean(selectedTime && slotsForDay.includes(selectedTime));
  const step1State: "pending" | "current" | "complete" = !step1Done ? "current" : "complete";
  const step2State: "pending" | "current" | "complete" = !step1Done ? "pending" : !step2Done ? "current" : "complete";

  return (
    <div className="mx-auto max-w-lg space-y-6 pb-10">
      <header className="text-center sm:text-left">
        <p className="text-xs font-semibold uppercase tracking-widest text-sky-600">Agendamento</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          {paymentComplete ? "Consulta confirmada" : awaitingPayment ? "Pagamento da consulta" : "Escolha data e horário"}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          {paymentComplete ? (
            <>
              Pagamento confirmado. Na lista de consultas o status aparece como{" "}
              <strong className="font-semibold text-slate-800">confirmada</strong>.
            </>
          ) : awaitingPayment ? (
            <>Use o Mercado Pago abaixo para concluir o pagamento e confirmar sua sessão.</>
          ) : (
            <>
              Mostramos apenas horários livres. Horários já reservados por você (agendada ou confirmada) não aparecem
              aqui.
            </>
          )}
        </p>
      </header>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-900/5">
        <div className="flex flex-col gap-4 bg-gradient-to-br from-slate-50 to-white p-5 sm:flex-row sm:items-center">
          <div
            className={`mx-auto flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-lg font-bold text-white shadow-md sm:mx-0 ${avatarClass}`}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="text-lg font-semibold text-slate-900">{bookable.nome}</p>
            <p className="mt-0.5 text-sm text-slate-600">
              {specialtyLabel}
              <span className="text-slate-400"> · </span>
              CRP {bookable.crp}
            </p>
            <p className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm sm:justify-start">
              <span className="font-semibold text-slate-800">R$ {priceFormatted}</span>
              <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-800">
                {bookable.duracao_minutos} min por sessão
              </span>
            </p>
            <Link
              href="/portal/agendar"
              className="mt-3 inline-block text-sm font-medium text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-900"
            >
              Trocar de profissional
            </Link>
          </div>
        </div>
      </div>

      {pickingSlots && !hasRawSlotsFromApi ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/95 p-5 text-center shadow-sm">
          <p className="text-sm font-medium text-amber-950">Nenhum horário livre nos próximos 7 dias</p>
          <p className="mt-2 text-xs leading-relaxed text-amber-900/85">
            Este profissional pode estar com a agenda cheia ou ainda não liberou novas datas. Você pode tentar outro
            profissional ou voltar em outro momento.
          </p>
          <Link
            href="/portal/agendar"
            className="mt-4 inline-flex rounded-xl bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-200"
          >
            Ver outras profissionais
          </Link>
        </div>
      ) : null}

      {pickingSlots && hasRawSlotsFromApi && !hasFreeSlotsAfterBookings ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/95 p-5 text-center shadow-sm">
          <p className="text-sm font-medium text-amber-950">Nenhum horário livre no momento</p>
          <p className="mt-2 text-xs leading-relaxed text-amber-900/85">
            Não há vagas disponíveis neste período. Tente outro profissional ou volte mais tarde.
          </p>
          <Link
            href="/portal/agendar"
            className="mt-4 inline-flex rounded-xl bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-200"
          >
            Ver outras profissionais
          </Link>
        </div>
      ) : null}

      {awaitingPayment && !hasFreeSlotsAfterBookings ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50/90 p-5 shadow-sm">
          <p className="text-sm font-medium text-sky-950">Horário reservado</p>
          <p className="mt-2 text-xs leading-relaxed text-sky-900/90">
            Sua consulta fica <strong className="font-semibold text-sky-950">agendada</strong> até o pagamento ser
            concluído; em seguida passa para <strong className="font-semibold text-sky-950">confirmada</strong>.
          </p>
        </div>
      ) : null}

      {pickingSlots && hasRawSlotsFromApi && hasFreeSlotsAfterBookings && !paymentComplete ? (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-900/5">
            <div className="flex items-start gap-3">
              <StepBadge n={1} state={step1State} />
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-slate-900">Qual dia prefere?</h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Próximos dias com vaga. Toque em um para ver os horários.
                </p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {dateOptions.length === 0 ? (
                    <p className="text-sm text-slate-500">Não há datas disponíveis neste período.</p>
                  ) : (
                    dateOptions.map((iso) => {
                      const selected = normalizeDayKey(selectedDate) === iso;
                      const row = dayRowForIso(iso);
                      const primary = row?.weekday_label ?? "";
                      return (
                        <button
                          key={iso}
                          type="button"
                          onClick={() => {
                            setSelectedDate(iso);
                            setSelectedTime("");
                          }}
                          aria-pressed={selected}
                          className={`flex min-h-[3.25rem] flex-col items-start justify-center rounded-xl border-2 px-4 py-2.5 text-left transition ${
                            selected
                              ? "border-sky-500 bg-sky-50 shadow-sm"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80"
                          }`}
                        >
                          <span className={`text-sm font-semibold ${selected ? "text-sky-950" : "text-slate-900"}`}>
                            {primary}
                          </span>
                          <span className="text-xs text-slate-500">{formatShortDatePt(iso)}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-900/5">
            <div className="flex items-start gap-3">
              <StepBadge n={2} state={step2State} />
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-slate-900">E o horário?</h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Início da consulta ({bookable.duracao_minutos} min de duração).
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {slotsForDay.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      {step1Done ? "Escolha outro dia na lista acima." : "Primeiro escolha um dia."}
                    </p>
                  ) : (
                    slotsForDay.map((t) => {
                      const picked = selectedTime === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setSelectedTime(t)}
                          aria-pressed={picked}
                          className={`min-h-[2.75rem] min-w-[4.5rem] rounded-xl border-2 px-4 py-2 text-sm font-semibold transition ${
                            picked
                              ? "border-sky-500 bg-sky-50 text-sky-950 shadow-sm"
                              : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          {formatClockPt(t)}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Resumo</h2>
            {selectedDate && selectedTime && step2Done ? (
              <p className="mt-2 text-sm leading-relaxed text-slate-700">
                <span className="font-medium text-slate-900">{formatLongDatePt(selectedDate)}</span>
                {" · "}
                <span className="font-medium text-slate-900">início às {formatClockPt(selectedTime)}</span>
                {" · "}
                <span className="text-slate-600">R$ {priceFormatted}</span>
              </p>
            ) : (
              <p className="mt-2 text-sm text-slate-500">Selecione dia e horário para ver o resumo aqui.</p>
            )}
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting || !selectedDate || !selectedTime || !hasFreeSlotsAfterBookings}
              className="mt-5 w-full rounded-xl bg-sky-600 px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Reservando…" : "Agendar consulta"}
            </button>
          </section>
        </>
      ) : null}

      {lastCharge ? (
        <section
          id="portal-schedule-payment"
          className="scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-900/5"
        >
          <h2 className="text-base font-semibold text-slate-900">Pagamento</h2>
          {lastCharge.gateway_status === "awaiting_payment" ? (
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              O valor da cobrança é o da consulta reservada. Ao finalizar no Mercado Pago, o status da consulta é
              atualizado automaticamente.
            </p>
          ) : (
            <p className="mt-1 text-xs leading-relaxed text-slate-600">Pagamento registrado com sucesso.</p>
          )}
          {selectedDate && selectedTime && lastCharge.gateway_status === "awaiting_payment" ? (
            <p className="mt-3 text-sm text-slate-700">
              <span className="font-medium text-slate-900">{formatLongDatePt(selectedDate)}</span>
              {" · "}
              <span className="font-medium text-slate-900">{formatClockPt(selectedTime)}</span>
            </p>
          ) : null}
          <dl className="mt-4 space-y-2 rounded-xl border border-slate-100 bg-slate-50/80 p-4 text-sm text-slate-800">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Valor</dt>
              <dd className="font-semibold">R$ {(lastCharge.amount_cents / 100).toFixed(2).replace(".", ",")}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Situação</dt>
              <dd className="font-medium">
                {lastCharge.gateway_status === "awaiting_payment" ? "Aguardando pagamento" : "Pago"}
              </dd>
            </div>
          </dl>
          {lastCharge.gateway_status === "awaiting_payment" ? (
            bookable && lastAppointmentId ? (
              <div className="mt-5 border-t border-slate-100 pt-5">
                <MercadoPagoCheckout
                  consultaId={lastAppointmentId}
                  product={{
                    title: `Consulta — ${bookable.nome}`,
                    quantity: 1,
                    unit_price: Math.round(lastCharge.amount_cents) / 100,
                  }}
                />
              </div>
            ) : (
              <p className="mt-4 text-sm text-rose-700">Não foi possível carregar os dados para o checkout. Atualize a página.</p>
            )
          ) : (
            <div className="mt-4 space-y-3 text-sm font-medium text-slate-700">
              <p>
                Consulta <strong className="text-slate-900">confirmada</strong> com pagamento registrado.
              </p>
              <p>
                <Link
                  href="/portal/consultas"
                  className="font-semibold text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-900"
                >
                  Ver minhas consultas
                </Link>
              </p>
              <button
                type="button"
                onClick={() => {
                  setLastCharge(null);
                  setLastAppointmentId(null);
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
              >
                Agendar outro horário
              </button>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
