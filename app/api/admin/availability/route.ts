import { NextResponse } from "next/server";
import { z } from "zod";
import { getProgressiveAvailability, setSlotStatus } from "@/app/lib/server/availability-store";
import { requirePortalRole } from "@/app/api/portal/_utils/backend-proxy";

const updateSlotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  status: z.enum(["available", "unavailable"]),
});

async function isAuthorizedAdmin(request: Request) {
  const auth = await requirePortalRole(request, ["admin"]);
  return auth.ok;
}

export async function GET(request: Request) {
  if (!(await isAuthorizedAdmin(request))) {
    return NextResponse.json({ message: "Nao autorizado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const days = searchParams.get("days") || undefined;
  const availability = await getProgressiveAvailability(days);

  return NextResponse.json({ availability });
}

export async function PATCH(request: Request) {
  if (!(await isAuthorizedAdmin(request))) {
    return NextResponse.json({ message: "Nao autorizado." }, { status: 401 });
  }

  const rawBody = await request.text().catch(() => "");
  let body: unknown = null;
  if (rawBody.trim()) {
    try {
      body = JSON.parse(rawBody) as unknown;
    } catch {
      return NextResponse.json({ message: "Payload invalido." }, { status: 400 });
    }
  }
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
