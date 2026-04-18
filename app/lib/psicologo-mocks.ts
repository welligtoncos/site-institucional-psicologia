/**
 * Dados fictícios do portal do psicólogo (frontend mockado) — uma profissional.
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

export type PsychologistAgendaAppointment = {
  id: string;
  patientName: string;
  isoDate: string;
  time: string;
  format: "Online" | "Presencial";
  status: "confirmada" | "pendente";
};

export const PSYCHOLOGIST_AGENDA_SEED: PsychologistAgendaAppointment[] = [
  {
    id: "p-1",
    patientName: "Mariana Costa",
    isoDate: "2026-04-20",
    time: "14:00",
    format: "Online",
    status: "confirmada",
  },
  {
    id: "p-2",
    patientName: "Eduardo Pires",
    isoDate: "2026-04-21",
    time: "10:00",
    format: "Presencial",
    status: "pendente",
  },
];

export function formatIsoDatePt(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}
