import { NextResponse } from "next/server";
import { getBackendApiUrl } from "@/app/lib/backend";

export type PortalRole = "patient" | "psychologist" | "admin";

type BackendPayload = Record<string, unknown>;

export async function readBackendPayload(response: Response): Promise<BackendPayload> {
  const raw = await response.text().catch(() => "");
  if (!raw.trim()) {
    return { detail: "Resposta vazia do backend." };
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as BackendPayload;
    }
    return { detail: "Resposta inválida do backend." };
  } catch {
    return { detail: "Resposta inválida do backend." };
  }
}

export async function toNextResponse(response: Response): Promise<NextResponse> {
  const data = await readBackendPayload(response);
  return NextResponse.json(data, { status: response.status });
}

export function readAuthorizationHeader(request: Request): string | null {
  return request.headers.get("authorization");
}

export async function requirePortalRole(
  request: Request,
  allowedRoles: PortalRole[],
): Promise<{ ok: true; authHeader: string } | { ok: false; response: NextResponse }> {
  const authHeader = readAuthorizationHeader(request);
  if (!authHeader) {
    return { ok: false, response: NextResponse.json({ detail: "Token de acesso ausente." }, { status: 401 }) };
  }

  const meResponse = await fetch(`${getBackendApiUrl()}/auth/me`, {
    method: "GET",
    headers: { Authorization: authHeader },
    cache: "no-store",
  });
  const meData = await readBackendPayload(meResponse);
  if (!meResponse.ok) {
    return { ok: false, response: NextResponse.json(meData, { status: meResponse.status }) };
  }
  const role = typeof meData.role === "string" ? meData.role : "";
  if (!allowedRoles.includes(role as PortalRole)) {
    return { ok: false, response: NextResponse.json({ detail: "Acesso não autorizado para este perfil." }, { status: 403 }) };
  }

  return { ok: true, authHeader };
}
