import { NextResponse } from "next/server";
import { getBackendApiUrl } from "@/app/lib/backend";
import { toNextResponse } from "@/app/api/portal/_utils/backend-proxy";

const MAX_ATTEMPTS_PER_WINDOW = 8;
const RATE_WINDOW_MS = 60_000;

type AttemptWindow = { count: number; resetAtMs: number };
const loginAttemptsByIp = new Map<string, AttemptWindow>();

function getClientIp(request: Request): string {
  const xf = request.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || "unknown";
  const xr = request.headers.get("x-real-ip");
  if (xr) return xr.trim();
  return "unknown";
}

function checkRateLimit(request: Request): { limited: boolean; retryAfterSec: number } {
  const now = Date.now();
  const ip = getClientIp(request);
  const current = loginAttemptsByIp.get(ip);
  if (!current || current.resetAtMs <= now) {
    loginAttemptsByIp.set(ip, { count: 1, resetAtMs: now + RATE_WINDOW_MS });
    return { limited: false, retryAfterSec: 0 };
  }
  if (current.count >= MAX_ATTEMPTS_PER_WINDOW) {
    return { limited: true, retryAfterSec: Math.max(1, Math.ceil((current.resetAtMs - now) / 1000)) };
  }
  current.count += 1;
  loginAttemptsByIp.set(ip, current);
  return { limited: false, retryAfterSec: 0 };
}

function compactAttemptsMap(): void {
  const now = Date.now();
  for (const [ip, value] of loginAttemptsByIp.entries()) {
    if (value.resetAtMs <= now) {
      loginAttemptsByIp.delete(ip);
    }
  }
}

export async function POST(request: Request) {
  compactAttemptsMap();
  const limit = checkRateLimit(request);
  if (limit.limited) {
    return NextResponse.json(
      { detail: "Muitas tentativas de login. Tente novamente em instantes." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ detail: "Payload invalido." }, { status: 400 });
  }

  const response = await fetch(`${getBackendApiUrl()}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  return toNextResponse(response);
}
