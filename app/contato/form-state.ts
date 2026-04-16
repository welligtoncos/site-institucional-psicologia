import { careTypes, schedulePreferences } from "../lib/validations/appointment";

export type AppointmentFieldValues = {
  name: string;
  email: string;
  phone: string;
  schedulePreference: (typeof schedulePreferences)[number];
  careType: (typeof careTypes)[number];
  appointmentDate: string;
  appointmentTime: string;
  message: string;
};

export type AppointmentFieldErrors = Partial<
  Record<keyof AppointmentFieldValues | "appointmentSlot", string>
>;

export type AppointmentFormState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors: AppointmentFieldErrors;
  values: AppointmentFieldValues;
};

export const initialAppointmentFormValues: AppointmentFieldValues = {
  name: "",
  email: "",
  phone: "",
  schedulePreference: "flexivel",
  careType: "presencial",
  appointmentDate: "",
  appointmentTime: "",
  message: "",
};

export const initialAppointmentFormState: AppointmentFormState = {
  status: "idle",
  message: "",
  fieldErrors: {},
  values: initialAppointmentFormValues,
};
