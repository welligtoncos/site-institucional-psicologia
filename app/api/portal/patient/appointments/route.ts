import { NextResponse } from "next/server";
import { getBackendApiUrl } from "@/app/lib/backend";
import { requirePortalRole, toNextResponse } from "@/app/api/portal/_utils/backend-proxy";

export async function POST(request: Request) {
  const auth = await requirePortalRole(request, ["patient"]);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  if (body === null || typeof body !== "object") {
    return NextResponse.json({ detail: "Corpo JSON inválido." }, { status: 400 });
  }

  const response = await fetch(`${getBackendApiUrl()}/profiles/patient/me/appointments`, {
    method: "POST",
    headers: {
      Authorization: auth.authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  return toNextResponse(response);
}

export async function GET(request: Request) {
  const auth = await requirePortalRole(request, ["patient"]);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const fromDate = url.searchParams.get("from_date");
  const qs = fromDate ? `?from_date=${encodeURIComponent(fromDate)}` : "";

  const response = await fetch(`${getBackendApiUrl()}/profiles/patient/me/appointments${qs}`, {
    method: "GET",
    headers: {
      Authorization: auth.authHeader,
    },
    cache: "no-store",
  });

  return toNextResponse(response);
}
