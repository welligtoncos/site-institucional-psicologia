import { NextResponse } from "next/server";
import { getBackendApiUrl } from "@/app/lib/backend";
import { toNextResponse } from "@/app/api/portal/_utils/backend-proxy";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !("refresh_token" in body)) {
    return NextResponse.json({ detail: "Refresh token ausente." }, { status: 400 });
  }

  const response = await fetch(`${getBackendApiUrl()}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  return toNextResponse(response);
}
