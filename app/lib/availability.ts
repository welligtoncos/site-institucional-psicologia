export type AppointmentSlotStatus = "available" | "unavailable";

export type AppointmentSlot = {
  time: string;
  status: AppointmentSlotStatus;
};

export type AppointmentAvailabilityDay = {
  date: string;
  label: string;
  slots: AppointmentSlot[];
};

export const BASE_TIME_SLOTS = ["08:00", "09:30", "11:00", "14:00", "15:30", "17:00", "18:30"] as const;

/** Apenas dias e horarios liberados para exibicao publica (agendamento). */
export function toPublicAvailabilitySchedule(days: AppointmentAvailabilityDay[]): AppointmentAvailabilityDay[] {
  return days
    .map((day) => ({
      ...day,
      slots: day.slots.filter((slot) => slot.status === "available"),
    }))
    .filter((day) => day.slots.length > 0);
}
