"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { submitAppointmentRequest } from "@/app/contato/actions";
import { appointmentAvailability } from "@/app/lib/mock/appointment-availability";
import { AvailabilityPicker } from "./AvailabilityPicker";
import {
  initialAppointmentFormState,
  type AppointmentFieldErrors,
} from "@/app/contato/form-state";

const defaultAvailabilityDay = appointmentAvailability[0];
const defaultAvailableSlot = defaultAvailabilityDay?.slots.find((slot) => slot.status !== "unavailable");

function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return <p className="mt-1 text-xs text-rose-600">{error}</p>;
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="sm:col-span-2 inline-flex items-center justify-center rounded-full bg-sky-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Enviando..." : "Enviar solicitacao"}
    </button>
  );
}

type InputProps = {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  autoComplete?: string;
  error?: string;
  className?: string;
};

function TextInput({
  label,
  name,
  type = "text",
  placeholder,
  defaultValue,
  required = true,
  autoComplete,
  error,
  className,
}: InputProps) {
  return (
    <label className={`text-sm font-medium text-slate-700 ${className ?? ""}`.trim()}>
      {label}
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        required={required}
        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
        placeholder={placeholder}
      />
      <FieldError error={error} />
    </label>
  );
}

function SelectInput({
  label,
  name,
  options,
  defaultValue,
  error,
}: {
  label: string;
  name: string;
  options: Array<{ value: string; label: string }>;
  defaultValue?: string;
  error?: string;
}) {
  return (
    <label className="text-sm font-medium text-slate-700">
      {label}
      <select
        name={name}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldError error={error} />
    </label>
  );
}

function statusClassByType(status: "idle" | "success" | "error") {
  if (status === "success") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (status === "error") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "";
}

export function AppointmentRequestForm() {
  const [state, formAction] = useActionState(submitAppointmentRequest, initialAppointmentFormState);
  const submittedAt = useMemo(() => String(Date.now()), [state.status]);
  const [appointmentDate, setAppointmentDate] = useState(
    state.values.appointmentDate || defaultAvailabilityDay?.date || "",
  );
  const [appointmentTime, setAppointmentTime] = useState(
    state.values.appointmentTime || defaultAvailableSlot?.time || "",
  );
  const errors: AppointmentFieldErrors = state.fieldErrors;

  useEffect(() => {
    if (state.status === "success") {
      setAppointmentDate(defaultAvailabilityDay?.date || "");
      setAppointmentTime(defaultAvailableSlot?.time || "");
      return;
    }

    if (state.values.appointmentDate) {
      setAppointmentDate(state.values.appointmentDate);
    }
    if (state.values.appointmentTime) {
      setAppointmentTime(state.values.appointmentTime);
    }
  }, [state.status, state.values.appointmentDate, state.values.appointmentTime]);

  return (
    <form action={formAction} className="mt-8 grid gap-4 sm:grid-cols-2">
      <input type="text" name="website" autoComplete="off" tabIndex={-1} className="hidden" />
      <input type="hidden" name="submittedAt" value={submittedAt} />
      <input type="hidden" name="appointmentDate" value={appointmentDate} />
      <input type="hidden" name="appointmentTime" value={appointmentTime} />

      {state.status !== "idle" && state.message ? (
        <p className={`sm:col-span-2 rounded-xl border px-4 py-3 text-sm ${statusClassByType(state.status)}`}>
          {state.message}
        </p>
      ) : null}

      <TextInput
        label="Nome completo"
        name="name"
        placeholder="Digite seu nome"
        defaultValue={state.values.name}
        className="sm:col-span-2"
        autoComplete="name"
        error={errors.name}
      />

      <TextInput
        label="Telefone"
        name="phone"
        type="tel"
        placeholder="(00) 00000-0000"
        defaultValue={state.values.phone}
        autoComplete="tel"
        error={errors.phone}
      />

      <TextInput
        label="E-mail"
        name="email"
        type="email"
        placeholder="voce@email.com"
        defaultValue={state.values.email}
        autoComplete="email"
        error={errors.email}
      />

      <AvailabilityPicker
        selectedDate={appointmentDate}
        selectedTime={appointmentTime}
        onSelectDate={setAppointmentDate}
        onSelectTime={setAppointmentTime}
        error={errors.appointmentSlot}
      />

      <SelectInput
        label="Preferencia de horario"
        name="schedulePreference"
        defaultValue={state.values.schedulePreference}
        error={errors.schedulePreference}
        options={[
          { value: "manha", label: "Manha" },
          { value: "tarde", label: "Tarde" },
          { value: "noite", label: "Noite" },
          { value: "flexivel", label: "Flexivel" },
        ]}
      />

      <SelectInput
        label="Tipo de atendimento"
        name="careType"
        defaultValue={state.values.careType}
        error={errors.careType}
        options={[
          { value: "presencial", label: "Presencial" },
          { value: "online", label: "Online" },
          { value: "hibrido", label: "Hibrido" },
        ]}
      />

      <label className="text-sm font-medium text-slate-700 sm:col-span-2">
        Mensagem
        <textarea
          name="message"
          rows={4}
          defaultValue={state.values.message}
          required
          className="mt-1 w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          placeholder="Conte brevemente o que voce precisa."
        />
        <FieldError error={errors.message} />
      </label>

      <p className="text-xs leading-relaxed text-slate-500 sm:col-span-2">
        Ao enviar, voce concorda com o contato da equipe para orientacoes iniciais de atendimento.
        Seus dados sao tratados com confidencialidade.
      </p>

      <SubmitButton />
    </form>
  );
}
