"use server";

import { Resend } from "resend";
import { buildAppointmentEmail } from "../lib/email/appointment-email-template";
import { isAvailableSlot } from "../lib/mock/appointment-availability";
import { siteConfig } from "../lib/site";
import { appointmentSchema } from "../lib/validations/appointment";
import {
  type AppointmentFieldErrors,
  type AppointmentFormState,
  initialAppointmentFormState,
} from "./form-state";

const MIN_SECONDS_BEFORE_SUBMIT = 3;

function toFieldErrors(errors: Record<string, string[] | undefined>): AppointmentFieldErrors {
  return {
    name: errors.name?.[0],
    email: errors.email?.[0],
    phone: errors.phone?.[0],
    schedulePreference: errors.schedulePreference?.[0],
    careType: errors.careType?.[0],
    appointmentDate: errors.appointmentDate?.[0],
    appointmentTime: errors.appointmentTime?.[0],
    appointmentSlot: errors.appointmentDate?.[0] || errors.appointmentTime?.[0],
    message: errors.message?.[0],
  };
}

function getFormValue(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}

export async function submitAppointmentRequest(
  _prevState: AppointmentFormState,
  formData: FormData,
): Promise<AppointmentFormState> {
  const values = {
    name: getFormValue(formData, "name"),
    email: getFormValue(formData, "email"),
    phone: getFormValue(formData, "phone"),
    schedulePreference: getFormValue(formData, "schedulePreference"),
    careType: getFormValue(formData, "careType"),
    appointmentDate: getFormValue(formData, "appointmentDate"),
    appointmentTime: getFormValue(formData, "appointmentTime"),
    message: getFormValue(formData, "message"),
    website: getFormValue(formData, "website"),
    submittedAt: getFormValue(formData, "submittedAt"),
  };

  const parsed = appointmentSchema.safeParse(values);

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;

    return {
      status: "error",
      message: "Revise os campos e tente novamente.",
      fieldErrors: toFieldErrors(errors),
      values: {
        name: values.name,
        email: values.email,
        phone: values.phone,
        schedulePreference:
          values.schedulePreference === "manha" ||
          values.schedulePreference === "tarde" ||
          values.schedulePreference === "noite" ||
          values.schedulePreference === "flexivel"
            ? values.schedulePreference
            : initialAppointmentFormState.values.schedulePreference,
        careType:
          values.careType === "presencial" ||
          values.careType === "online" ||
          values.careType === "hibrido"
            ? values.careType
            : initialAppointmentFormState.values.careType,
        appointmentDate: values.appointmentDate,
        appointmentTime: values.appointmentTime,
        message: values.message,
      },
    };
  }

  if (!isAvailableSlot(parsed.data.appointmentDate, parsed.data.appointmentTime)) {
    return {
      status: "error",
      message: "O horario selecionado nao esta mais disponivel. Escolha outro para continuar.",
      fieldErrors: {
        appointmentSlot: "Horario indisponivel no momento.",
      },
      values: {
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone,
        schedulePreference: parsed.data.schedulePreference,
        careType: parsed.data.careType,
        appointmentDate: parsed.data.appointmentDate,
        appointmentTime: parsed.data.appointmentTime,
        message: parsed.data.message,
      },
    };
  }

  if (parsed.data.website) {
    return {
      ...initialAppointmentFormState,
      status: "success",
      message: "Solicitacao enviada com sucesso. Nossa equipe entrara em contato em breve.",
    };
  }

  const elapsedInSeconds = (Date.now() - Number(parsed.data.submittedAt)) / 1000;

  if (elapsedInSeconds < MIN_SECONDS_BEFORE_SUBMIT) {
    return {
      status: "error",
      message: "Aguarde alguns segundos e envie novamente.",
      fieldErrors: {},
      values: {
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone,
        schedulePreference: parsed.data.schedulePreference,
        careType: parsed.data.careType,
        appointmentDate: parsed.data.appointmentDate,
        appointmentTime: parsed.data.appointmentTime,
        message: parsed.data.message,
      },
    };
  }

  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not configured.");
    return {
      status: "error",
      message: "Servico de envio indisponivel no momento. Tente novamente mais tarde.",
      fieldErrors: {},
      values: {
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone,
        schedulePreference: parsed.data.schedulePreference,
        careType: parsed.data.careType,
        appointmentDate: parsed.data.appointmentDate,
        appointmentTime: parsed.data.appointmentTime,
        message: parsed.data.message,
      },
    };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const to = process.env.CLINIC_CONTACT_EMAIL || siteConfig.email;
  const from = process.env.RESEND_FROM_EMAIL || "Clinica Harmonia <onboarding@resend.dev>";
  const emailPayload = buildAppointmentEmail(parsed.data);

  try {
    await resend.emails.send({
      from,
      to: [to],
      replyTo: parsed.data.email,
      subject: emailPayload.subject,
      html: emailPayload.html,
      text: emailPayload.text,
    });

    return {
      ...initialAppointmentFormState,
      status: "success",
      message: "Solicitacao enviada com sucesso. Nossa equipe entrara em contato em breve.",
    };
  } catch (error) {
    console.error("Failed to send appointment request:", error);

    return {
      status: "error",
      message: "Nao foi possivel enviar sua solicitacao agora. Tente novamente em instantes.",
      fieldErrors: {},
      values: {
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone,
        schedulePreference: parsed.data.schedulePreference,
        careType: parsed.data.careType,
        appointmentDate: parsed.data.appointmentDate,
        appointmentTime: parsed.data.appointmentTime,
        message: parsed.data.message,
      },
    };
  }
}
