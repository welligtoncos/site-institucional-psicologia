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
  psychologist_online?: boolean;
  session_phase?: "patient_waiting" | "live" | "ended" | null;
  session_started_at?: string | null;
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

export type ApiPatientAppointmentListResponse = {
  appointments: ApiPatientAppointmentSummary[];
};

export type ApiAppointmentJoinRoomResponse = {
  appointment: ApiPatientAppointmentSummary;
  join_url: string;
  started_now: boolean;
};

export type ApiAppointmentLeaveRoomResponse = {
  appointment: ApiPatientAppointmentSummary;
  left_now: boolean;
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

export async function listPatientAppointments(
  fromDate?: string,
): Promise<{ ok: true; data: ApiPatientAppointmentListResponse } | { ok: false; detail: string }> {
  const token = readToken();
  if (!token) return { ok: false, detail: "Sua sessão expirou. Faça login novamente." };

  const qs = fromDate?.trim() ? `?from_date=${encodeURIComponent(fromDate.trim())}` : "";
  const response = await fetch(`/api/portal/patient/appointments${qs}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as ApiPatientAppointmentListResponse | { detail?: unknown } | null;
  if (!response.ok || !data || typeof data !== "object" || !("appointments" in data) || !Array.isArray(data.appointments)) {
    const detail = typeof data === "object" && data && "detail" in data ? String(data.detail ?? "") : "";
    return { ok: false, detail: detail || "Não foi possível listar as consultas." };
  }
  return { ok: true, data: data as ApiPatientAppointmentListResponse };
}

export async function joinPatientAppointmentRoom(
  appointmentId: string,
): Promise<{ ok: true; data: ApiAppointmentJoinRoomResponse } | { ok: false; detail: string }> {
  const token = readToken();
  if (!token) return { ok: false, detail: "Sua sessão expirou. Faça login novamente." };

  const response = await fetch(`/api/portal/patient/appointments/${encodeURIComponent(appointmentId)}/join-room`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as ApiAppointmentJoinRoomResponse | { detail?: unknown } | null;
  if (
    !response.ok ||
    !data ||
    typeof data !== "object" ||
    !("appointment" in data) ||
    !("join_url" in data) ||
    typeof data.join_url !== "string"
  ) {
    const detail = typeof data === "object" && data && "detail" in data ? String(data.detail ?? "") : "";
    return { ok: false, detail: detail || "Não foi possível entrar na sala." };
  }
  return { ok: true, data: data as ApiAppointmentJoinRoomResponse };
}

export async function leavePatientAppointmentRoom(
  appointmentId: string,
): Promise<{ ok: true; data: ApiAppointmentLeaveRoomResponse } | { ok: false; detail: string }> {
  const token = readToken();
  if (!token) return { ok: false, detail: "Sua sessão expirou. Faça login novamente." };

  const response = await fetch(`/api/portal/patient/appointments/${encodeURIComponent(appointmentId)}/leave-room`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as ApiAppointmentLeaveRoomResponse | { detail?: unknown } | null;
  if (
    !response.ok ||
    !data ||
    typeof data !== "object" ||
    !("appointment" in data) ||
    !("left_now" in data)
  ) {
    const detail = typeof data === "object" && data && "detail" in data ? String(data.detail ?? "") : "";
    return { ok: false, detail: detail || "Não foi possível sair da sala." };
  }
  return { ok: true, data: data as ApiAppointmentLeaveRoomResponse };
}
