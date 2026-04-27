type AppointmentStatusLike = "agendada" | "confirmada" | "pendente" | "em_andamento" | "realizada" | "cancelada" | "nao_compareceu";

function parseLocalAppointmentStart(isoDate: string, hhmm: string): Date | null {
  const [year, month, day] = isoDate.split("-").map(Number);
  const [hour, minute] = hhmm.split(":").map(Number);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute)
  ) {
    return null;
  }
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

/**
 * Finaliza automaticamente sessões online "em andamento" quando o horário já terminou.
 * Evita ficar preso em status ativo se o encerramento manual não ocorrer.
 */
export function normalizeEndedLiveSessionStatus(args: {
  status: AppointmentStatusLike;
  isoDate: string;
  time: string;
  durationMin?: number | null;
  format?: "Online" | "Presencial";
}): AppointmentStatusLike {
  if (args.status !== "em_andamento") return args.status;
  if (args.format && args.format !== "Online") return args.status;

  const start = parseLocalAppointmentStart(args.isoDate, args.time);
  if (!start) return args.status;

  const safeDuration = Number.isFinite(args.durationMin) && (args.durationMin ?? 0) > 0 ? Number(args.durationMin) : 50;
  const endsAt = new Date(start.getTime() + safeDuration * 60 * 1000);
  if (Date.now() >= endsAt.getTime()) return "realizada";
  return args.status;
}
