/** Evita deslocamento de fuso ao interpretar `AAAA-MM-DD` vindos da API. */
export function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function calendarDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Rótulo curto para cards de agenda (ex.: Ter, 27/04). */
export function agendaDayTitle(day: { date: string; weekday_label: string }): string {
  const [y, m, d] = day.date.split("-").map(Number);
  if (!y || !m || !d) return day.weekday_label;
  const dd = String(d).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  return `${day.weekday_label}, ${dd}/${mm}`;
}
