import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { BASE_TIME_SLOTS, type AppointmentAvailabilityDay, type AppointmentSlotStatus } from "../availability";

type AvailabilityOverrides = Record<string, Partial<Record<(typeof BASE_TIME_SLOTS)[number], AppointmentSlotStatus>>>;

const STORAGE_PATH = path.join(process.cwd(), "data", "availability-overrides.json");
const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDaysAhead(raw: string | undefined) {
  const parsed = Number(raw || "14");
  if (!Number.isFinite(parsed)) return 14;
  return Math.min(60, Math.max(7, Math.round(parsed)));
}

function formatDayLabel(date: Date) {
  const weekday = WEEKDAY_LABELS[date.getDay()];
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${weekday}, ${day}/${month}`;
}

async function ensureStorageFile() {
  const directory = path.dirname(STORAGE_PATH);
  await fs.mkdir(directory, { recursive: true });

  try {
    await fs.access(STORAGE_PATH);
  } catch {
    await fs.writeFile(STORAGE_PATH, "{}", "utf-8");
  }
}

async function readOverrides(): Promise<AvailabilityOverrides> {
  await ensureStorageFile();
  const content = await fs.readFile(STORAGE_PATH, "utf-8");

  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as AvailabilityOverrides;
  } catch {
    return {};
  }
}

async function writeOverrides(data: AvailabilityOverrides) {
  await ensureStorageFile();
  await fs.writeFile(STORAGE_PATH, JSON.stringify(data, null, 2), "utf-8");
}

function isDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function getProgressiveAvailability(daysAheadRaw?: string): Promise<AppointmentAvailabilityDay[]> {
  const daysAhead = parseDaysAhead(daysAheadRaw || process.env.AVAILABILITY_DAYS_AHEAD);
  const today = new Date();
  const overrides = await readOverrides();

  const result: AppointmentAvailabilityDay[] = [];

  for (let index = 0; index < daysAhead; index += 1) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + index);
    const dateKey = toDateKey(date);
    const dateOverride = overrides[dateKey] || {};

    result.push({
      date: dateKey,
      label: formatDayLabel(date),
      slots: BASE_TIME_SLOTS.map((time) => ({
        time,
        status: dateOverride[time] === "available" ? "available" : "unavailable",
      })),
    });
  }

  return result;
}

export async function isAvailableSlot(date: string, time: string) {
  if (!isDateKey(date)) return false;
  if (!BASE_TIME_SLOTS.includes(time as (typeof BASE_TIME_SLOTS)[number])) return false;

  const overrides = await readOverrides();
  const status = overrides[date]?.[time as (typeof BASE_TIME_SLOTS)[number]];
  return status === "available";
}

export async function setSlotStatus(input: { date: string; time: string; status: AppointmentSlotStatus }) {
  const { date, time, status } = input;
  if (!isDateKey(date)) {
    throw new Error("Data invalida. Use formato YYYY-MM-DD.");
  }
  if (!BASE_TIME_SLOTS.includes(time as (typeof BASE_TIME_SLOTS)[number])) {
    throw new Error("Horario invalido.");
  }

  const overrides = await readOverrides();
  const currentDate = overrides[date] ?? {};
  const timeKey = time as (typeof BASE_TIME_SLOTS)[number];

  if (status === "available") {
    currentDate[timeKey] = "available";
  } else {
    delete currentDate[timeKey];
  }

  if (Object.keys(currentDate).length === 0) {
    delete overrides[date];
  } else {
    overrides[date] = currentDate;
  }

  await writeOverrides(overrides);
}
