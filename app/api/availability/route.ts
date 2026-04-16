import { NextResponse } from "next/server";
import { getProgressiveAvailability } from "@/app/lib/server/availability-store";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = searchParams.get("days") || undefined;
  const availability = await getProgressiveAvailability(days || undefined);
  return NextResponse.json({ availability });
}
