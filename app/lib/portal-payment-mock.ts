/**
 * RF-009 / RF-010 — Pagamento (mock no navegador).
 * - Gerar cobrança: registro financeiro + identificadores de integração futura com gateway.
 * - Registrar pagamento: atualizar status conforme “retorno do gateway” (simulado).
 */

import {
  MOCK_APPOINTMENTS_SEED,
  PORTAL_APPOINTMENTS_STORAGE_KEY,
  type MockAppointment,
} from "@/app/lib/portal-mocks";

export const PORTAL_PAYMENT_CHARGES_STORAGE_KEY = "portal_payment_charges_mock_v1";

/** Status da cobrança no “gateway” (mock). */
export type MockGatewayChargeStatus = "awaiting_payment" | "succeeded" | "failed";

export type MockPaymentCharge = {
  id: string;
  appointmentId: string;
  amountCents: number;
  currency: "BRL";
  /** Nome do provedor que será usado em produção (placeholder). */
  gatewayProvider: string;
  /** ID do payment intent / charge no gateway (mock). */
  gatewayIntentId: string;
  gatewayStatus: MockGatewayChargeStatus;
  createdAt: string;
  paidAt?: string;
};

function newIntentId(): string {
  const r = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : String(Date.now());
  return `pi_mock_${r}`;
}

function newChargeId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID ? `chg_${crypto.randomUUID().slice(0, 8)}` : `chg_${Date.now()}`;
}

function loadChargesRaw(): MockPaymentCharge[] {
  if (typeof window === "undefined") return PAYMENT_CHARGES_SEED;
  try {
    const raw = localStorage.getItem(PORTAL_PAYMENT_CHARGES_STORAGE_KEY);
    if (!raw) return [...PAYMENT_CHARGES_SEED];
    const parsed = JSON.parse(raw) as MockPaymentCharge[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [...PAYMENT_CHARGES_SEED];
  } catch {
    return [...PAYMENT_CHARGES_SEED];
  }
}

function saveChargesRaw(list: MockPaymentCharge[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PORTAL_PAYMENT_CHARGES_STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("portal-billing-changed"));
}

function loadAppointmentsRaw(): MockAppointment[] {
  if (typeof window === "undefined") return MOCK_APPOINTMENTS_SEED;
  try {
    const raw = localStorage.getItem(PORTAL_APPOINTMENTS_STORAGE_KEY);
    if (!raw) return MOCK_APPOINTMENTS_SEED;
    const parsed = JSON.parse(raw) as MockAppointment[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : MOCK_APPOINTMENTS_SEED;
  } catch {
    return MOCK_APPOINTMENTS_SEED;
  }
}

function saveAppointmentsRaw(list: MockAppointment[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PORTAL_APPOINTMENTS_STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("portal-billing-changed"));
}

/** Cobrança inicial de demonstração (consulta apt-2 pendente). */
const PAYMENT_CHARGES_SEED: MockPaymentCharge[] = [
  {
    id: "chg_demo_apt2",
    appointmentId: "apt-2",
    amountCents: Math.round(190 * 100),
    currency: "BRL",
    gatewayProvider: "stripe_compatible_mock",
    gatewayIntentId: "pi_mock_demo_apt2",
    gatewayStatus: "awaiting_payment",
    createdAt: new Date("2026-04-01T12:00:00.000Z").toISOString(),
  },
];

/**
 * RF-009 — Cria registro financeiro e prepara integração (intent id mock).
 * Persiste cobrança e associa à consulta.
 */
export function createChargeForAppointment(appointmentId: string, amountReais: number): MockPaymentCharge {
  const charge: MockPaymentCharge = {
    id: newChargeId(),
    appointmentId,
    amountCents: Math.round(amountReais * 100),
    currency: "BRL",
    gatewayProvider: "stripe_compatible_mock",
    gatewayIntentId: newIntentId(),
    gatewayStatus: "awaiting_payment",
    createdAt: new Date().toISOString(),
  };
  const list = loadChargesRaw().filter((c) => c.id !== charge.id);
  list.push(charge);
  saveChargesRaw(list);

  const appts = loadAppointmentsRaw().map((a) =>
    a.id === appointmentId ? { ...a, chargeId: charge.id } : a,
  );
  saveAppointmentsRaw(appts);
  return charge;
}

export function getChargeById(chargeId: string): MockPaymentCharge | undefined {
  return loadChargesRaw().find((c) => c.id === chargeId);
}

/** Lista todas as cobranças (área de faturamento do paciente). */
export function getAllPaymentCharges(): MockPaymentCharge[] {
  return loadChargesRaw();
}

/** Consultas do paciente (mesma fonte das outras telas do portal). */
export function getPatientAppointments(): MockAppointment[] {
  return loadAppointmentsRaw();
}

/**
 * Cobrança mais recente ainda aguardando pagamento, para o profissional informado
 * (útil após F5 na tela de agendar — o estado React do cartão de pagamento some, mas o mock persiste).
 */
export function getLatestAwaitingChargeForPsychologist(psychId: string): MockPaymentCharge | null {
  if (!psychId.trim()) return null;
  const appts = loadAppointmentsRaw();
  let best: MockPaymentCharge | null = null;
  let bestCreated = "";
  for (const c of loadChargesRaw()) {
    if (c.gatewayStatus !== "awaiting_payment") continue;
    const a = appts.find((x) => x.id === c.appointmentId);
    if (!a || a.psychId !== psychId) continue;
    if (a.payment !== "Pendente") continue;
    if (!best || c.createdAt > bestCreated) {
      best = c;
      bestCreated = c.createdAt;
    }
  }
  return best;
}

/**
 * RF-010 — Simula webhook / retorno do gateway: marca cobrança paga e atualiza consulta.
 */
export function registerGatewayPaymentSuccess(chargeId: string): {
  ok: true;
  charge: MockPaymentCharge;
  appointment: MockAppointment;
} | {
  ok: false;
  error: string;
} {
  const charges = loadChargesRaw();
  const idx = charges.findIndex((c) => c.id === chargeId);
  if (idx === -1) return { ok: false, error: "Cobrança não encontrada." };
  const c = charges[idx]!;
  if (c.gatewayStatus === "succeeded") {
    return { ok: false, error: "Pagamento já registrado." };
  }
  if (c.gatewayStatus === "failed") {
    return { ok: false, error: "Cobrança em estado de falha." };
  }

  const updated: MockPaymentCharge = {
    ...c,
    gatewayStatus: "succeeded",
    paidAt: new Date().toISOString(),
  };
  charges[idx] = updated;
  saveChargesRaw(charges);

  const appts = loadAppointmentsRaw();
  const ai = appts.findIndex((a) => a.id === c.appointmentId);
  if (ai === -1) {
    return { ok: false, error: "Consulta vinculada não encontrada." };
  }
  const apt = appts[ai]!;
  const nextStatus: MockAppointment["status"] = apt.status === "agendada" ? "confirmada" : apt.status;
  const attachMeetLink =
    apt.format === "Online" && nextStatus === "confirmada" && !apt.videoCallLink?.trim();
  const nextApt: MockAppointment = {
    ...apt,
    payment: "Pago",
    status: nextStatus,
    reminder: apt.reminder?.includes("Aguardando pagamento") ? "Pagamento confirmado." : apt.reminder,
    videoCallLink: attachMeetLink ? `https://meet.exemplo.com/${encodeURIComponent(apt.id)}` : apt.videoCallLink,
  };
  appts[ai] = nextApt;
  saveAppointmentsRaw(appts);

  return { ok: true, charge: updated, appointment: nextApt };
}

export function appendAppointment(appointment: MockAppointment): void {
  const list = loadAppointmentsRaw();
  list.push(appointment);
  saveAppointmentsRaw(list);
}

/**
 * Marca a consulta do portal como realizada quando o psicólogo encerra a sessão ao vivo (mock).
 */
export function markAppointmentCompletedAfterLiveSession(appointmentId: string): boolean {
  if (typeof window === "undefined") return false;
  const list = loadAppointmentsRaw();
  const idx = list.findIndex((a) => a.id === appointmentId);
  if (idx === -1) return false;
  const apt = list[idx]!;
  const noteExtra = "Atendimento concluído (sessão ao vivo — demonstração).";
  list[idx] = {
    ...apt,
    status: "realizada",
    notes: apt.notes?.includes("concluído") ? apt.notes : [apt.notes?.trim(), noteExtra].filter(Boolean).join(" · "),
  };
  saveAppointmentsRaw(list);
  return true;
}
