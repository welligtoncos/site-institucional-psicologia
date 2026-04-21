import { todayIso, type PsychologistAgendaAppointment, type TimeBlock } from "@/app/lib/psicologo-mocks";

const ACCESS_TOKEN_KEY = "portal_access_token";

export type ApiPsychologistAgendaAppointment = {
  id: string;
  patient_id: string;
  patient_name: string;
  iso_date: string;
  time: string;
  format: "Online" | "Presencial";
  status: "confirmada" | "pendente" | "cancelada" | "realizada" | "em_andamento";
  payment_pending: boolean;
  patient_online?: boolean;
  duration_min?: number;
  video_call_link?: string | null;
  session_phase?: "patient_waiting" | "live" | "ended" | null;
  session_started_at?: string | null;
};

export type ApiPsychologistAgendaBlock = {
  id: string;
  iso_date: string;
  all_day: boolean;
  start_time?: string | null;
  end_time?: string | null;
  note: string;
};

export type ApiPsychologistAgendaResponse = {
  from_date: string;
  appointments: ApiPsychologistAgendaAppointment[];
  blocks: ApiPsychologistAgendaBlock[];
};

export type ApiPsychologistOnlineAppointmentResponse = {
  appointment: ApiPsychologistAgendaAppointment;
  join_url?: string | null;
  notes?: string;
};

export function apiAgendaToMock(data: ApiPsychologistAgendaResponse): {
  appointments: PsychologistAgendaAppointment[];
  blocks: TimeBlock[];
} {
  return {
    appointments: data.appointments.map((a) => ({
      id: a.id,
      patientId: a.patient_id,
      patientName: a.patient_name,
      isoDate: a.iso_date,
      time: a.time,
      format: a.format,
      status: a.status,
      pagamentoPendente: a.payment_pending,
      patientOnline: Boolean(a.patient_online),
      durationMin: a.duration_min ?? 50,
      videoCallLink: a.video_call_link ?? undefined,
      sessionPhase: a.session_phase ?? undefined,
      sessionStartedAt: a.session_started_at ?? undefined,
    })),
    blocks: data.blocks.map((b) => ({
      id: b.id,
      isoDate: b.iso_date,
      allDay: b.all_day,
      startTime: b.start_time ?? undefined,
      endTime: b.end_time ?? undefined,
      note: b.note,
    })),
  };
}

export async function fetchPsychologistAgenda(
  fromDate: string = todayIso(),
): Promise<{ ok: boolean; status: number; data: ApiPsychologistAgendaResponse | { detail?: string } }> {
  const token = typeof window !== "undefined" ? window.localStorage.getItem(ACCESS_TOKEN_KEY) : null;
  if (!token) return { ok: false, status: 401, data: { detail: "Token ausente." } };

  const response = await fetch(`/api/portal/psychologist/agenda?from_date=${encodeURIComponent(fromDate)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as ApiPsychologistAgendaResponse | { detail?: string } | null;
  if (!data || typeof data !== "object") {
    return { ok: false, status: response.status, data: { detail: "Resposta inválida do servidor." } };
  }
  return { ok: response.ok, status: response.status, data };
}

async function authedRequest(path: string, init: RequestInit): Promise<Response> {
  const token = typeof window !== "undefined" ? window.localStorage.getItem(ACCESS_TOKEN_KEY) : null;
  if (!token) throw new Error("Token ausente.");
  return fetch(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
}

export async function joinPsychologistRoom(
  appointmentId: string,
): Promise<{ ok: true; data: ApiPsychologistOnlineAppointmentResponse } | { ok: false; detail: string }> {
  try {
    const response = await authedRequest(`/api/portal/psychologist/appointments/${encodeURIComponent(appointmentId)}/join-room`, {
      method: "POST",
    });
    const data = (await response.json().catch(() => null)) as ApiPsychologistOnlineAppointmentResponse | { detail?: unknown } | null;
    if (!response.ok || !data || typeof data !== "object" || !("appointment" in data)) {
      const detail = typeof data === "object" && data && "detail" in data ? String(data.detail ?? "") : "";
      return { ok: false, detail: detail || "Não foi possível entrar na sala." };
    }
    return { ok: true, data: data as ApiPsychologistOnlineAppointmentResponse };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : "Falha de conexão." };
  }
}

export async function finishPsychologistAppointment(
  appointmentId: string,
): Promise<{ ok: true; data: ApiPsychologistOnlineAppointmentResponse } | { ok: false; detail: string }> {
  try {
    const response = await authedRequest(`/api/portal/psychologist/appointments/${encodeURIComponent(appointmentId)}/finish`, {
      method: "POST",
    });
    const data = (await response.json().catch(() => null)) as ApiPsychologistOnlineAppointmentResponse | { detail?: unknown } | null;
    if (!response.ok || !data || typeof data !== "object" || !("appointment" in data)) {
      const detail = typeof data === "object" && data && "detail" in data ? String(data.detail ?? "") : "";
      return { ok: false, detail: detail || "Não foi possível finalizar a consulta." };
    }
    return { ok: true, data: data as ApiPsychologistOnlineAppointmentResponse };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : "Falha de conexão." };
  }
}

export async function patchPsychologistAppointmentNotes(
  appointmentId: string,
  notes: string,
): Promise<{ ok: true; data: ApiPsychologistOnlineAppointmentResponse } | { ok: false; detail: string }> {
  try {
    const response = await authedRequest(`/api/portal/psychologist/appointments/${encodeURIComponent(appointmentId)}/notes`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    const data = (await response.json().catch(() => null)) as ApiPsychologistOnlineAppointmentResponse | { detail?: unknown } | null;
    if (!response.ok || !data || typeof data !== "object" || !("appointment" in data)) {
      const detail = typeof data === "object" && data && "detail" in data ? String(data.detail ?? "") : "";
      return { ok: false, detail: detail || "Não foi possível salvar observações." };
    }
    return { ok: true, data: data as ApiPsychologistOnlineAppointmentResponse };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : "Falha de conexão." };
  }
}

export async function patchPsychologistAppointmentMeetingLink(
  appointmentId: string,
  joinUrl: string,
): Promise<{ ok: true; data: ApiPsychologistOnlineAppointmentResponse } | { ok: false; detail: string }> {
  try {
    const response = await authedRequest(
      `/api/portal/psychologist/appointments/${encodeURIComponent(appointmentId)}/meeting-link`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ join_url: joinUrl }),
      },
    );
    const data = (await response.json().catch(() => null)) as ApiPsychologistOnlineAppointmentResponse | { detail?: unknown } | null;
    if (!response.ok || !data || typeof data !== "object" || !("appointment" in data)) {
      const detail = typeof data === "object" && data && "detail" in data ? String(data.detail ?? "") : "";
      return { ok: false, detail: detail || "Não foi possível salvar o link da videochamada." };
    }
    return { ok: true, data: data as ApiPsychologistOnlineAppointmentResponse };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : "Falha de conexão." };
  }
}
