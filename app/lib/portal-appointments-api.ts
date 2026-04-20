const ACCESS_TOKEN_KEY = "portal_access_token";

export type ApiPatientAppointmentSummary = {
  id: string;
  psychologist_id: string;
  psychologist_name: string;
  psychologist_crp: string;
  patient_name: string;
  specialty: string;
  iso_date: string;
  time: string;
  format: "Online" | "Presencial";
  price: string;
  duration_min: number;
  payment: "Pago" | "Pendente";
  status: "agendada" | "confirmada" | "em_andamento" | "realizada" | "cancelada" | "nao_compareceu";
  video_call_link?: string | null;
};

export type ApiPatientChargeSummary = {
  id: string;
  appointment_id: string;
  amount_cents: number;
  currency: "BRL";
  gateway_provider: string;
  gateway_intent_id: string;
  gateway_status: "awaiting_payment" | "succeeded" | "failed";
  created_at: string;
  paid_at?: string | null;
};

export type ApiPatientAppointmentCreateResponse = {
  appointment: ApiPatientAppointmentSummary;
  charge: ApiPatientChargeSummary;
};

function readToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export async function createPatientAppointment(payload: {
  psychologist_id: string;
  iso_date: string;
  time: string;
  format: "Online" | "Presencial";
}): Promise<{ ok: true; data: ApiPatientAppointmentCreateResponse } | { ok: false; detail: string }> {
  const token = readToken();
  if (!token) return { ok: false, detail: "Sua sessão expirou. Faça login novamente." };

  const response = await fetch("/api/portal/patient/appointments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as ApiPatientAppointmentCreateResponse | { detail?: unknown } | null;
  if (!response.ok || !data || typeof data !== "object" || !("appointment" in data) || !("charge" in data)) {
    const detail = typeof data === "object" && data && "detail" in data ? String(data.detail ?? "") : "";
    return { ok: false, detail: detail || "Não foi possível criar a consulta." };
  }
  return { ok: true, data: data as ApiPatientAppointmentCreateResponse };
}

export async function simulatePatientAppointmentPayment(
  appointmentId: string,
): Promise<{ ok: true; data: ApiPatientAppointmentCreateResponse } | { ok: false; detail: string }> {
  const token = readToken();
  if (!token) return { ok: false, detail: "Sua sessão expirou. Faça login novamente." };

  const response = await fetch(`/api/portal/patient/appointments/${encodeURIComponent(appointmentId)}/simulate-payment`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as ApiPatientAppointmentCreateResponse | { detail?: unknown } | null;
  if (!response.ok || !data || typeof data !== "object" || !("appointment" in data) || !("charge" in data)) {
    const detail = typeof data === "object" && data && "detail" in data ? String(data.detail ?? "") : "";
    return { ok: false, detail: detail || "Não foi possível registrar o pagamento." };
  }
  return { ok: true, data: data as ApiPatientAppointmentCreateResponse };
}
