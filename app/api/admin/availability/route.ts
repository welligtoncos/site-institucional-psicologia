import { NextResponse } from "next/server";
import { z } from "zod";
import { getProgressiveAvailability, setSlotStatus } from "@/app/lib/server/availability-store";

const updateSlotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  status: z.enum(["available", "unavailable"]),
});

function getRequestToken(request: Request) {
  const headerToken = request.headers.get("x-admin-token");
  const authHeader = request.headers.get("authorization");
  if (headerToken) return headerToken;
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }
  return "";
}

function isAuthorized(request: Request) {
  const configured = process.env.ADMIN_API_TOKEN;
  if (!configured) return false;
  const token = getRequestToken(request);
  return token === configured;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Nao autorizado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const days = searchParams.get("days") || undefined;
  const availability = await getProgressiveAvailability(days);

  return NextResponse.json({ availability });
}

export async function PATCH(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Nao autorizado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSlotSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Payload invalido.", errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    await setSlotStatus(parsed.data);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Falha ao atualizar horario." },
      { status: 400 },
    );
  }

  const availability = await getProgressiveAvailability();
  return NextResponse.json({ message: "Horario atualizado com sucesso.", availability });
}
