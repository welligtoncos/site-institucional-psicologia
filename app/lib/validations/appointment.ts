import { z } from "zod";

export const schedulePreferences = ["manha", "tarde", "noite", "flexivel"] as const;
export const careTypes = ["presencial", "online", "hibrido"] as const;

export const appointmentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Informe seu nome completo.")
    .max(120, "Nome muito longo."),
  email: z
    .string()
    .trim()
    .email("Informe um e-mail valido.")
    .max(160, "E-mail muito longo."),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9()+\-\s]{10,20}$/, "Informe um telefone valido com DDD."),
  schedulePreference: z.enum(schedulePreferences, {
    message: "Selecione a preferencia de horario.",
  }),
  careType: z.enum(careTypes, {
    message: "Selecione o tipo de atendimento.",
  }),
  message: z
    .string()
    .trim()
    .min(10, "Escreva uma mensagem com pelo menos 10 caracteres.")
    .max(1000, "Mensagem muito longa."),
  appointmentDate: z.string().trim().min(1, "Selecione uma data disponivel."),
  appointmentTime: z.string().trim().min(1, "Selecione um horario disponivel."),
  website: z.string().trim().optional().default(""),
  submittedAt: z
    .string()
    .trim()
    .regex(/^\d+$/, "Campo de seguranca invalido."),
});

export type AppointmentInput = z.infer<typeof appointmentSchema>;
