/**
 * Dados fictícios para o portal do paciente (frontend mockado).
 * Substituir por chamadas à API quando o backend estiver disponível.
 */

export type MockPsychologist = {
  id: string;
  name: string;
  crp: string;
  initials: string;
  avatarClass: string;
  specialties: string[];
  /** Rótulo principal para filtros */
  primarySpecialty: string;
  bio: string;
  price: number;
  durationMin: number;
  formats: ("Online" | "Presencial")[];
  /** Tem pelo menos um horário na semana mockada */
  availableThisWeek: boolean;
};

/** Gera chaves yyyy-mm-dd para os próximos `days` dias a partir de `base`. */
export function nextDates(base: Date, days: number): string[] {
  const out: string[] = [];
  const d = new Date(base);
  for (let i = 0; i < days; i++) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${day}`);
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** Horários mockados por data (alguns dias com menos opções). */
export function mockSlotsForDate(psychId: string, isoDate: string): string[] {
  const seed = psychId.charCodeAt(psychId.length - 1) + isoDate.charCodeAt(isoDate.length - 1);
  const base = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
  if (seed % 5 === 0) return base.slice(0, 4);
  if (seed % 5 === 1) return base.slice(2, 6);
  return base;
}

/** Profissional única cadastrada no mock (demonstração). */
export const MOCK_PSYCHOLOGIST: MockPsychologist = {
  id: "psy-ana",
  name: "Ana Clara Mendes",
  crp: "06/123456",
  initials: "AM",
  avatarClass: "from-sky-400 to-indigo-500",
  specialties: ["Ansiedade", "TCC"],
  primarySpecialty: "Ansiedade e TCC",
  bio: "Psicóloga clínica com TCC e foco em ansiedade. Atendimento online e presencial.",
  price: 190,
  durationMin: 50,
  formats: ["Online", "Presencial"],
  availableThisWeek: true,
};

export const MOCK_PSYCHOLOGISTS: MockPsychologist[] = [MOCK_PSYCHOLOGIST];

export const ALL_SPECIALTY_LABELS = Array.from(
  new Set(MOCK_PSYCHOLOGISTS.flatMap((p) => p.specialties)),
).sort();

export function filterPsychologists(params: {
  specialty: string;
  maxPrice: number;
  onlyAvailable: boolean;
}): MockPsychologist[] {
  return MOCK_PSYCHOLOGISTS.filter((p) => {
    if (params.specialty !== "todas" && !p.specialties.includes(params.specialty)) {
      return false;
    }
    if (p.price > params.maxPrice) return false;
    if (params.onlyAvailable && !p.availableThisWeek) return false;
    return true;
  });
}

/** —— Consultas do paciente (mock) —— */

export type MockAppointmentStatus =
  | "agendada"
  | "confirmada"
  | "em_andamento"
  | "realizada"
  | "cancelada"
  | "nao_compareceu";

export type MockAppointment = {
  id: string;
  psychId: string;
  psychologist: string;
  /** CRP do profissional (quando conhecido no agendamento). */
  psychologistCrp?: string;
  specialty: string;
  /** Nome do paciente (mock) — usado na área do psicólogo / faturas. */
  patientName?: string;
  isoDate: string;
  time: string;
  format: "Online" | "Presencial";
  price: number;
  durationMin: number;
  payment: "Pago" | "Pendente";
  status: MockAppointmentStatus;
  /** RF-009: vínculo com registro financeiro / cobrança (gateway). */
  chargeId?: string;
  reminder?: string;
  videoCallLink?: string;
  notes?: string;
};

/** Chave única do localStorage das consultas (paciente). */
export const PORTAL_APPOINTMENTS_STORAGE_KEY = "portal_appointments_mock_v1";

/** Antecedência mínima para cancelar ou remarcar (horas). */
export const PORTAL_CANCEL_MIN_HOURS = 24;

export function portalAppointmentStart(isoDate: string, time: string): Date {
  const [h, min] = time.split(":").map(Number);
  const [y, mo, d] = isoDate.split("-").map(Number);
  return new Date(y, mo - 1, d, h, min, 0, 0);
}

export function canModifyAppointment(isoDate: string, time: string): { ok: true } | { ok: false; message: string } {
  const start = portalAppointmentStart(isoDate, time);
  const limit = new Date(start.getTime() - PORTAL_CANCEL_MIN_HOURS * 60 * 60 * 1000);
  if (Date.now() > limit.getTime()) {
    return {
      ok: false,
      message: `Pela política vigente, cancelamento e remarcação precisam ser feitos com pelo menos ${PORTAL_CANCEL_MIN_HOURS} horas de antecedência em relação ao horário da sessão.`,
    };
  }
  return { ok: true };
}

export function formatAppointmentDatePt(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const P = MOCK_PSYCHOLOGIST;

export const MOCK_APPOINTMENTS_SEED: MockAppointment[] = [
  {
    id: "apt-1",
    psychId: P.id,
    psychologist: P.name,
    psychologistCrp: P.crp,
    patientName: "Mariana Costa",
    specialty: "Ansiedade",
    isoDate: "2026-04-20",
    time: "14:00",
    format: "Online",
    price: P.price,
    durationMin: P.durationMin,
    payment: "Pago",
    status: "confirmada",
    reminder: "Lembrete 2 h antes.",
    videoCallLink: "https://meet.exemplo.com/sessao-1",
    notes: "",
  },
  {
    id: "apt-2",
    psychId: P.id,
    psychologist: P.name,
    psychologistCrp: P.crp,
    patientName: "Eduardo Pires",
    specialty: "Ansiedade",
    isoDate: "2026-04-23",
    time: "10:00",
    format: "Presencial",
    price: P.price,
    durationMin: P.durationMin,
    payment: "Pendente",
    status: "agendada",
    chargeId: "chg_demo_apt2",
    reminder: "Aguardando pagamento da consulta.",
    notes: "",
  },
  {
    id: "apt-h1",
    psychId: P.id,
    psychologist: P.name,
    psychologistCrp: P.crp,
    patientName: "Luísa Mendes",
    specialty: "Ansiedade",
    isoDate: "2026-04-05",
    time: "10:30",
    format: "Online",
    price: P.price,
    durationMin: P.durationMin,
    payment: "Pago",
    status: "realizada",
    notes: "Sessão concluída.",
  },
  {
    id: "apt-h2",
    psychId: P.id,
    psychologist: P.name,
    psychologistCrp: P.crp,
    patientName: "Carlos Henrique",
    specialty: "Ansiedade",
    isoDate: "2026-03-28",
    time: "15:00",
    format: "Online",
    price: P.price,
    durationMin: P.durationMin,
    payment: "Pago",
    status: "cancelada",
    notes: "Cancelada pelo paciente.",
  },
];

export function isAppointmentUpcoming(a: MockAppointment): boolean {
  return a.status === "agendada" || a.status === "confirmada" || a.status === "em_andamento";
}

export function isAppointmentHistory(a: MockAppointment): boolean {
  return a.status === "realizada" || a.status === "cancelada" || a.status === "nao_compareceu";
}
