import { todayIso, type PsychologistAgendaAppointment, type TimeBlock } from "@/app/lib/psicologo-mocks";

const ACCESS_TOKEN_KEY = "portal_access_token";

export type ApiPsychologistAgendaAppointment = {
  id: string;
  patient_id: string;
  patient_name: string;
  iso_date: string;
  time: string;
  format: "Online" | "Presencial";
  status: "confirmada" | "pendente" | "cancelada" | "realizada";
  payment_pending: boolean;
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
