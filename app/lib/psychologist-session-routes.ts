import { extractConsultaIdFromLiveRef } from "@/app/lib/live-session-shared";

/**
 * Rota da sala de atendimento do psicólogo.
 * `portal:uuid` (estado vindo do paciente/reconcile) é normalizado para `appointment:uuid`, que é o ref da agenda.
 */
export function psychologistSessionRoomPath(ref: string): string {
  let pathRef = ref;
  if (ref.startsWith("portal:")) {
    const id = extractConsultaIdFromLiveRef(ref);
    if (id) pathRef = `appointment:${id}`;
  }
  return `/psicologo/sessao/${encodeURIComponent(pathRef)}`;
}

/** Alinha `selectedRef` com a lista de salas (`appointment:id`). */
export function normalizePsychologistSalaSelectedRef(ref: string): string {
  if (ref.startsWith("portal:")) {
    const id = extractConsultaIdFromLiveRef(ref);
    if (id) return `appointment:${id}`;
  }
  return ref;
}
