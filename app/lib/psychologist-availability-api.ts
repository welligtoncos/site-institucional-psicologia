import type { PsychologistAvailabilityMock, TimeBlock, Weekday } from "@/app/lib/psicologo-mocks";

const ACCESS_TOKEN_KEY = "portal_access_token";

export type ApiWeeklySlot = {
  id: string;
  weekday: number;
  enabled: boolean;
  start: string;
  end: string;
};

export type ApiAgendaBlock = {
  id: string;
  iso_date: string;
  all_day: boolean;
  start_time?: string | null;
  end_time?: string | null;
  note: string;
};

export type ApiPsychologistAvailability = {
  weekly: ApiWeeklySlot[];
  blocks: ApiAgendaBlock[];
};

export function apiToMock(api: ApiPsychologistAvailability): PsychologistAvailabilityMock {
  return {
    weekly: api.weekly.map((w) => ({
      weekday: w.weekday as Weekday,
      enabled: w.enabled,
      start: w.start,
      end: w.end,
    })),
    blocks: api.blocks.map(
      (b): TimeBlock => ({
        id: b.id,
        isoDate: b.iso_date,
        allDay: b.all_day,
        startTime: b.start_time ?? undefined,
        endTime: b.end_time ?? undefined,
        note: b.note,
      }),
    ),
  };
}

export function mockToApiPayload(data: PsychologistAvailabilityMock): Record<string, unknown> {
  return {
    weekly: data.weekly.map((w) => ({
      weekday: w.weekday,
      enabled: w.enabled,
      start: w.start,
      end: w.end,
    })),
    blocks: data.blocks.map((b) => ({
      iso_date: b.isoDate,
      all_day: b.allDay,
      start_time: b.allDay ? null : (b.startTime ?? null),
      end_time: b.allDay ? null : (b.endTime ?? null),
      note: b.note,
    })),
  };
}

export async function fetchPsychologistAvailability(): Promise<{ ok: boolean; status: number; data: ApiPsychologistAvailability | { detail?: string } }> {
  const token = typeof window !== "undefined" ? window.localStorage.getItem(ACCESS_TOKEN_KEY) : null;
  if (!token) {
    return { ok: false, status: 401, data: { detail: "Token ausente." } };
  }
  const response = await fetch("/api/portal/psychologist/availability", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = (await response.json()) as ApiPsychologistAvailability | { detail?: string };
  return { ok: response.ok, status: response.status, data };
}

export async function putPsychologistAvailability(
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; data: ApiPsychologistAvailability | { detail?: string } }> {
  const token = typeof window !== "undefined" ? window.localStorage.getItem(ACCESS_TOKEN_KEY) : null;
  if (!token) {
    return { ok: false, status: 401, data: { detail: "Token ausente." } };
  }
  const response = await fetch("/api/portal/psychologist/availability", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const data = (await response.json()) as ApiPsychologistAvailability | { detail?: string };
  return { ok: response.ok, status: response.status, data };
}
