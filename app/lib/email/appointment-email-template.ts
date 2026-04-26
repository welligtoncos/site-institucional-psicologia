import { type AppointmentInput } from "../validations/appointment";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatSchedulePreference(value: AppointmentInput["schedulePreference"]) {
  switch (value) {
    case "manha":
      return "Manha";
    case "tarde":
      return "Tarde";
    case "noite":
      return "Noite";
    default:
      return "Flexivel";
  }
}

function formatCareType(value: AppointmentInput["careType"]) {
  switch (value) {
    case "presencial":
      return "Presencial";
    case "online":
      return "Online";
    default:
      return "Hibrido";
  }
}

function formatAppointmentDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString("pt-BR");
}

export function buildAppointmentEmail(data: AppointmentInput) {
  const submittedAt = new Date(Number(data.submittedAt)).toLocaleString("pt-BR");
  const payload = {
    name: escapeHtml(data.name),
    email: escapeHtml(data.email),
    phone: escapeHtml(data.phone),
    appointmentDate: escapeHtml(formatAppointmentDate(data.appointmentDate)),
    appointmentTime: escapeHtml(data.appointmentTime),
    schedulePreference: escapeHtml(formatSchedulePreference(data.schedulePreference)),
    careType: escapeHtml(formatCareType(data.careType)),
    message: escapeHtml(data.message).replaceAll("\n", "<br />"),
    submittedAt: escapeHtml(submittedAt),
  };

  const subject = `Novo pedido de agendamento - ${data.name}`;

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
      <h2 style="margin: 0 0 12px;">Novo pedido de agendamento</h2>
      <p style="margin: 0 0 24px; color: #334155;">Formulario enviado pelo site Psicologo Online Ja.</p>

      <table style="border-collapse: collapse; width: 100%; max-width: 640px;">
        <tbody>
          <tr><td style="padding: 8px 0; font-weight: bold;">Nome:</td><td style="padding: 8px 0;">${payload.name}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold;">E-mail:</td><td style="padding: 8px 0;">${payload.email}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold;">Telefone:</td><td style="padding: 8px 0;">${payload.phone}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold;">Horario do pedido:</td><td style="padding: 8px 0;">${payload.appointmentDate} as ${payload.appointmentTime}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold;">Preferencia de horario:</td><td style="padding: 8px 0;">${payload.schedulePreference}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold;">Tipo de atendimento:</td><td style="padding: 8px 0;">${payload.careType}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold;">Enviado em:</td><td style="padding: 8px 0;">${payload.submittedAt}</td></tr>
        </tbody>
      </table>

      <div style="margin-top: 20px; padding: 16px; background: #f8fafc; border-radius: 10px;">
        <p style="margin: 0 0 8px; font-weight: bold;">Mensagem</p>
        <p style="margin: 0;">${payload.message}</p>
      </div>
    </div>
  `;

  const text = [
    "Novo pedido de agendamento",
    "",
    `Nome: ${data.name}`,
    `E-mail: ${data.email}`,
    `Telefone: ${data.phone}`,
    `Horario do pedido: ${formatAppointmentDate(data.appointmentDate)} as ${data.appointmentTime}`,
    `Preferencia de horario: ${formatSchedulePreference(data.schedulePreference)}`,
    `Tipo de atendimento: ${formatCareType(data.careType)}`,
    `Enviado em: ${submittedAt}`,
    "",
    "Mensagem:",
    data.message,
  ].join("\n");

  return { subject, html, text };
}
