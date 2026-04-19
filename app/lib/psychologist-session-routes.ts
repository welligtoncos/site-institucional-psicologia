/** Rota da sala de atendimento (ref = `portal:id` ou `agenda:id`). */
export function psychologistSessionRoomPath(ref: string): string {
  return `/psicologo/sessao/${encodeURIComponent(ref)}`;
}
