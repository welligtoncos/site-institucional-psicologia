/** Nome/e-mail do paciente logado (cache local para mocks e telas sem React Context). */

export const PORTAL_PATIENT_SNAPSHOT_KEY = "portal_patient_snapshot_v1";

export type PortalPatientSnapshot = {
  name: string;
  email: string;
};

export function savePortalPatientSnapshot(s: PortalPatientSnapshot): void {
  if (typeof window === "undefined") return;
  const name = s.name?.trim() ?? "";
  const email = s.email?.trim() ?? "";
  if (!name && !email) return;
  window.localStorage.setItem(PORTAL_PATIENT_SNAPSHOT_KEY, JSON.stringify({ name, email }));
}

export function readPortalPatientSnapshot(): PortalPatientSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PORTAL_PATIENT_SNAPSHOT_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<PortalPatientSnapshot>;
    if (typeof p.name !== "string" || typeof p.email !== "string") return null;
    return { name: p.name.trim(), email: p.email.trim() };
  } catch {
    return null;
  }
}

export function clearPortalPatientSnapshot(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PORTAL_PATIENT_SNAPSHOT_KEY);
}
