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

export const MOCK_PSYCHOLOGISTS: MockPsychologist[] = [
  {
    id: "psy-ana",
    name: "Ana Clara Mendes",
    crp: "06/123456",
    initials: "AM",
    avatarClass: "from-sky-400 to-indigo-500",
    specialties: ["Ansiedade e estresse", "TCC"],
    primarySpecialty: "Ansiedade e estresse",
    bio: "Psicóloga clínica com foco em ansiedade generalizada e síndrome do pânico. Trabalho com TCC e técnicas de regulação emocional em um ambiente acolhedor.",
    price: 190,
    durationMin: 50,
    formats: ["Online", "Presencial"],
    availableThisWeek: true,
  },
  {
    id: "psy-beatriz",
    name: "Beatriz Lima",
    crp: "06/234567",
    initials: "BL",
    avatarClass: "from-rose-400 to-orange-400",
    specialties: ["Terapia de casal", "Relacionamentos"],
    primarySpecialty: "Terapia de casal",
    bio: "Especialista em dinâmicas de casal e comunicação não violenta. Experiência em mediação de conflitos e reaproximação afetiva.",
    price: 240,
    durationMin: 60,
    formats: ["Presencial"],
    availableThisWeek: true,
  },
  {
    id: "psy-rafael",
    name: "Rafael Souza",
    crp: "06/345678",
    initials: "RS",
    avatarClass: "from-emerald-400 to-teal-600",
    specialties: ["Depressão e luto", "Adultos"],
    primarySpecialty: "Depressão e luto",
    bio: "Atendimento a adultos em processos de luto complicado e humor deprimido, com abordagem humanista integrada a recursos da psicoeducação.",
    price: 210,
    durationMin: 50,
    formats: ["Online"],
    availableThisWeek: true,
  },
  {
    id: "psy-lucia",
    name: "Lúcia Ferreira",
    crp: "06/456789",
    initials: "LF",
    avatarClass: "from-violet-400 to-purple-600",
    specialties: ["Adolescentes", "Autoestima"],
    primarySpecialty: "Adolescentes",
    bio: "Atua com adolescentes e famílias em mediação de limites saudáveis e fortalecimento de autoestima. Abordagem sistêmica.",
    price: 200,
    durationMin: 50,
    formats: ["Online", "Presencial"],
    availableThisWeek: false,
  },
];

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
  specialty: string;
  isoDate: string;
  time: string;
  format: "Online" | "Presencial";
  price: number;
  durationMin: number;
  payment: "Pago" | "Pendente";
  status: MockAppointmentStatus;
  reminder?: string;
  videoCallLink?: string;
  notes?: string;
};

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

const psychById = (id: string) => MOCK_PSYCHOLOGISTS.find((p) => p.id === id);

export const MOCK_APPOINTMENTS_SEED: MockAppointment[] = [
  {
    id: "apt-1",
    psychId: "psy-ana",
    psychologist: psychById("psy-ana")?.name ?? "Ana Clara Mendes",
    specialty: "Ansiedade e estresse",
    isoDate: "2026-04-20",
    time: "14:00",
    format: "Online",
    price: 190,
    durationMin: 50,
    payment: "Pago",
    status: "confirmada",
    reminder: "Lembrete: 2 h antes da sessão.",
    videoCallLink: "https://meet.exemplo.com/sessao-apt-1",
    notes: "Sessão de acompanhamento.",
  },
  {
    id: "apt-2",
    psychId: "psy-beatriz",
    psychologist: psychById("psy-beatriz")?.name ?? "Beatriz Lima",
    specialty: "Terapia de casal",
    isoDate: "2026-04-23",
    time: "19:00",
    format: "Presencial",
    price: 240,
    durationMin: 60,
    payment: "Pendente",
    status: "agendada",
    reminder: "Confirme o pagamento para liberar o lembrete automático.",
    notes: "Recepção: chegar com 15 min de antecedência.",
  },
  {
    id: "apt-3",
    psychId: "psy-rafael",
    psychologist: psychById("psy-rafael")?.name ?? "Rafael Souza",
    specialty: "Depressão e luto",
    isoDate: "2026-04-17",
    time: "16:00",
    format: "Online",
    price: 210,
    durationMin: 50,
    payment: "Pago",
    status: "em_andamento",
    reminder: "Sessão em andamento ou iniciando em breve.",
    videoCallLink: "https://meet.exemplo.com/sessao-apt-3",
    notes: "Demonstração: status “em andamento”.",
  },
  {
    id: "apt-4",
    psychId: "psy-ana",
    psychologist: psychById("psy-ana")?.name ?? "Ana Clara Mendes",
    specialty: "Ansiedade e estresse",
    isoDate: "2026-04-25",
    time: "09:00",
    format: "Online",
    price: 190,
    durationMin: 50,
    payment: "Pago",
    status: "confirmada",
    reminder: "Lembrete: 24 h antes.",
    videoCallLink: "https://meet.exemplo.com/sessao-apt-4",
    notes: "Retorno agendado.",
  },
  {
    id: "apt-h1",
    psychId: "psy-rafael",
    psychologist: psychById("psy-rafael")?.name ?? "Rafael Souza",
    specialty: "Depressão e luto",
    isoDate: "2026-04-05",
    time: "10:30",
    format: "Online",
    price: 210,
    durationMin: 50,
    payment: "Pago",
    status: "realizada",
    notes: "Sessão concluída; exercícios de respiração combinados.",
  },
  {
    id: "apt-h2",
    psychId: "psy-beatriz",
    psychologist: psychById("psy-beatriz")?.name ?? "Beatriz Lima",
    specialty: "Terapia de casal",
    isoDate: "2026-03-30",
    time: "18:00",
    format: "Presencial",
    price: 240,
    durationMin: 60,
    payment: "Pendente",
    status: "cancelada",
    notes: "Cancelada pelo paciente dentro do prazo.",
  },
  {
    id: "apt-h3",
    psychId: "psy-lucia",
    psychologist: psychById("psy-lucia")?.name ?? "Lúcia Ferreira",
    specialty: "Adolescentes",
    isoDate: "2026-04-10",
    time: "15:00",
    format: "Online",
    price: 200,
    durationMin: 50,
    payment: "Pago",
    status: "nao_compareceu",
    notes: "Não comparecimento sem aviso prévio.",
  },
];

export function isAppointmentUpcoming(a: MockAppointment): boolean {
  return a.status === "agendada" || a.status === "confirmada" || a.status === "em_andamento";
}

export function isAppointmentHistory(a: MockAppointment): boolean {
  return a.status === "realizada" || a.status === "cancelada" || a.status === "nao_compareceu";
}
