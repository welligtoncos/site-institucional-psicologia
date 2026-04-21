/**
 * Dados fictícios do portal do psicólogo (frontend mockado).
 */

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const WEEKDAY_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

export const WEEKDAY_LONG: Record<Weekday, string> = {
  0: "Domingo",
  1: "Segunda-feira",
  2: "Terça-feira",
  3: "Quarta-feira",
  4: "Quinta-feira",
  5: "Sexta-feira",
  6: "Sábado",
};

export type PsychologistProfileMock = {
  crp: string;
  bio: string;
  sessionPrice: number;
  photoDataUrl: string;
  specialties: string[];
};

export const PSYCHOLOGIST_PROFILE_SEED: PsychologistProfileMock = {
  crp: "06/199988",
  bio: "Psicóloga clínica (TCC). Atendo adultos e adolescentes, presencial e online.",
  sessionPrice: 190,
  photoDataUrl: "",
  specialties: ["Ansiedade", "TCC"],
};

export type DaySlot = {
  weekday: Weekday;
  enabled: boolean;
  start: string;
  end: string;
};

export type TimeBlock = {
  id: string;
  isoDate: string;
  allDay: boolean;
  startTime?: string;
  endTime?: string;
  note: string;
};

export type PsychologistAvailabilityMock = {
  weekly: DaySlot[];
  blocks: TimeBlock[];
};

function defaultWeekly(): DaySlot[] {
  return [
    { weekday: 1, enabled: true, start: "09:00", end: "18:00" },
    { weekday: 2, enabled: true, start: "09:00", end: "18:00" },
    { weekday: 3, enabled: true, start: "09:00", end: "18:00" },
    { weekday: 4, enabled: true, start: "09:00", end: "18:00" },
    { weekday: 5, enabled: true, start: "09:00", end: "17:00" },
    { weekday: 6, enabled: false, start: "09:00", end: "13:00" },
    { weekday: 0, enabled: false, start: "09:00", end: "13:00" },
  ];
}

export const PSYCHOLOGIST_AVAILABILITY_SEED: PsychologistAvailabilityMock = {
  weekly: defaultWeekly(),
  blocks: [
    {
      id: "blk-1",
      isoDate: "2026-04-22",
      allDay: true,
      note: "Indisponível",
    },
  ],
};

export type AgendaSessionStatus = "confirmada" | "pendente" | "cancelada" | "realizada" | "em_andamento";

export type PsychologistAgendaAppointment = {
  id: string;
  patientId: string;
  patientName: string;
  isoDate: string;
  time: string;
  format: "Online" | "Presencial";
  status: AgendaSessionStatus;
  /** Para alertas de pagamento no painel */
  pagamentoPendente?: boolean;
  /** Presença do paciente na sala de atendimento online. */
  patientOnline?: boolean;
  /** Duração oficial da consulta retornada pela API. */
  durationMin?: number;
  /** Link de videochamada salvo para a consulta. */
  videoCallLink?: string;
  /** Fase atual da sessão ao vivo (quando existir). */
  sessionPhase?: "patient_waiting" | "live" | "ended";
  /** Momento em que o cronômetro foi iniciado no backend. */
  sessionStartedAt?: string;
};

export const PSYCHOLOGIST_AGENDA_STORAGE_KEY = "psychologist_agenda_mock_v1";

export const PSYCHOLOGIST_AGENDA_SEED: PsychologistAgendaAppointment[] = [
  {
    id: "sess-1",
    patientId: "pac-1",
    patientName: "Mariana Costa",
    isoDate: "2026-04-17",
    time: "09:00",
    format: "Presencial",
    status: "confirmada",
  },
  {
    id: "sess-2",
    patientId: "pac-2",
    patientName: "Eduardo Pires",
    isoDate: "2026-04-17",
    time: "15:30",
    format: "Online",
    status: "pendente",
    pagamentoPendente: true,
  },
  {
    id: "sess-3",
    patientId: "pac-3",
    patientName: "Luísa Mendes",
    isoDate: "2026-04-18",
    time: "10:00",
    format: "Online",
    status: "confirmada",
  },
  {
    id: "sess-4",
    patientId: "pac-4",
    patientName: "Carlos Henrique",
    isoDate: "2026-04-19",
    time: "16:00",
    format: "Presencial",
    status: "pendente",
  },
  {
    id: "sess-5",
    patientId: "pac-1",
    patientName: "Mariana Costa",
    isoDate: "2026-04-21",
    time: "14:00",
    format: "Online",
    status: "confirmada",
  },
  {
    id: "sess-6",
    patientId: "pac-5",
    patientName: "Paula Ribeiro",
    isoDate: "2026-04-24",
    time: "11:00",
    format: "Presencial",
    status: "confirmada",
  },
  {
    id: "sess-7",
    patientId: "pac-2",
    patientName: "Eduardo Pires",
    isoDate: "2026-04-25",
    time: "09:30",
    format: "Online",
    status: "pendente",
    pagamentoPendente: true,
  },
];

export type PatientStatus = "ativo" | "acompanhamento" | "encerrado";

export type PsychologistPatient = {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: PatientStatus;
  firstVisitIso: string;
  /** Sessões registradas no mock */
  sessionsCount: number;
};

export const PSYCHOLOGIST_PATIENTS_SEED: PsychologistPatient[] = [
  {
    id: "pac-1",
    name: "Mariana Costa",
    email: "mariana.costa@email.com",
    phone: "(11) 98765-4321",
    status: "acompanhamento",
    firstVisitIso: "2026-01-08",
    sessionsCount: 14,
  },
  {
    id: "pac-2",
    name: "Eduardo Pires",
    email: "eduardo.pires@email.com",
    phone: "(11) 91234-5678",
    status: "ativo",
    firstVisitIso: "2026-03-15",
    sessionsCount: 4,
  },
  {
    id: "pac-3",
    name: "Luísa Mendes",
    email: "luisa.m@email.com",
    phone: "(21) 99876-5432",
    status: "acompanhamento",
    firstVisitIso: "2026-02-20",
    sessionsCount: 8,
  },
  {
    id: "pac-4",
    name: "Carlos Henrique",
    email: "carlos.h@email.com",
    phone: "(11) 97777-1111",
    status: "ativo",
    firstVisitIso: "2026-04-01",
    sessionsCount: 2,
  },
  {
    id: "pac-5",
    name: "Paula Ribeiro",
    email: "paula.r@email.com",
    phone: "(11) 96655-4433",
    status: "encerrado",
    firstVisitIso: "2025-08-10",
    sessionsCount: 22,
  },
];

export type PsychologistAlertType = "pagamento" | "cancelamento" | "mensagem";

export type PsychologistAlert = {
  id: string;
  type: PsychologistAlertType;
  message: string;
  createdAt: string;
};

export const PSYCHOLOGIST_ALERTS_SEED: PsychologistAlert[] = [
  {
    id: "al-1",
    type: "pagamento",
    message: "Eduardo Pires — pagamento da sessão ainda pendente (21/04).",
    createdAt: "2026-04-16T10:00:00.000Z",
  },
  {
    id: "al-2",
    type: "cancelamento",
    message: "Solicitação de remarcação: Carlos Henrique (via portal paciente).",
    createdAt: "2026-04-16T14:30:00.000Z",
  },
  {
    id: "al-3",
    type: "mensagem",
    message: "Central da clínica: 1 recado não lido sobre documentação.",
    createdAt: "2026-04-17T08:00:00.000Z",
  },
];

export function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function loadAgendaAppointments(): PsychologistAgendaAppointment[] {
  if (typeof window === "undefined") return PSYCHOLOGIST_AGENDA_SEED;
  try {
    const raw = localStorage.getItem(PSYCHOLOGIST_AGENDA_STORAGE_KEY);
    if (!raw) return PSYCHOLOGIST_AGENDA_SEED;
    const parsed = JSON.parse(raw) as PsychologistAgendaAppointment[];
    if (!Array.isArray(parsed)) return PSYCHOLOGIST_AGENDA_SEED;
    return parsed;
  } catch {
    return PSYCHOLOGIST_AGENDA_SEED;
  }
}

export function persistAgendaAppointments(list: PsychologistAgendaAppointment[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PSYCHOLOGIST_AGENDA_STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("psychologist-agenda-changed"));
}

/** Marca sessão da agenda interna como realizada após encerrar atendimento ao vivo (mock). */
export function markAgendaSessionCompleted(sessionId: string): boolean {
  const list = loadAgendaAppointments();
  const idx = list.findIndex((s) => s.id === sessionId);
  if (idx === -1) return false;
  list[idx] = { ...list[idx]!, status: "realizada" };
  persistAgendaAppointments(list);
  return true;
}

export function formatIsoDatePt(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

export function formatIsoDateLong(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function patientStatusLabel(s: PatientStatus): string {
  if (s === "ativo") return "Ativo";
  if (s === "acompanhamento") return "Em acompanhamento";
  return "Encerrado";
}
