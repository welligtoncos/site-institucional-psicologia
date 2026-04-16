export type AppointmentSlotStatus = "available" | "limited" | "unavailable";

export type AppointmentSlot = {
  time: string;
  status: AppointmentSlotStatus;
};

export type AppointmentAvailabilityDay = {
  date: string;
  label: string;
  slots: AppointmentSlot[];
};

export const appointmentAvailability: AppointmentAvailabilityDay[] = [
  {
    date: "2026-04-20",
    label: "Seg, 20/04",
    slots: [
      { time: "09:00", status: "available" },
      { time: "10:30", status: "limited" },
      { time: "14:00", status: "available" },
      { time: "16:30", status: "unavailable" },
    ],
  },
  {
    date: "2026-04-21",
    label: "Ter, 21/04",
    slots: [
      { time: "08:30", status: "limited" },
      { time: "11:00", status: "available" },
      { time: "15:00", status: "available" },
      { time: "19:00", status: "unavailable" },
    ],
  },
  {
    date: "2026-04-22",
    label: "Qua, 22/04",
    slots: [
      { time: "09:30", status: "available" },
      { time: "13:30", status: "limited" },
      { time: "17:00", status: "available" },
      { time: "18:30", status: "unavailable" },
    ],
  },
  {
    date: "2026-04-23",
    label: "Qui, 23/04",
    slots: [
      { time: "08:00", status: "available" },
      { time: "10:00", status: "limited" },
      { time: "14:30", status: "available" },
      { time: "17:30", status: "unavailable" },
    ],
  },
];

export function findAvailabilityDay(date: string) {
  return appointmentAvailability.find((day) => day.date === date);
}

export function isAvailableSlot(date: string, time: string) {
  const day = findAvailabilityDay(date);
  const slot = day?.slots.find((item) => item.time === time);
  return Boolean(slot && slot.status !== "unavailable");
}
