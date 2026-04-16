"use client";

import { useMemo, useState } from "react";

type Professional = {
  id: string;
  name: string;
  specialty: string;
  price: number;
  slots: string[];
};

const PROFESSIONALS: Professional[] = [
  {
    id: "p1",
    name: "Dra. Ana Clara",
    specialty: "Ansiedade e estresse",
    price: 190,
    slots: ["Seg, 06/05 - 14:00", "Qua, 08/05 - 10:30", "Sex, 10/05 - 16:00"],
  },
  {
    id: "p2",
    name: "Dra. Beatriz Lima",
    specialty: "Terapia de casal",
    price: 240,
    slots: ["Ter, 07/05 - 19:00", "Qui, 09/05 - 18:00", "Sab, 11/05 - 09:30"],
  },
  {
    id: "p3",
    name: "Dr. Rafael Souza",
    specialty: "Depressao e luto",
    price: 210,
    slots: ["Seg, 06/05 - 09:00", "Qua, 08/05 - 15:00", "Sex, 10/05 - 11:00"],
  },
];

export function ScheduleConsultationBoard() {
  const [selectedProfessionalId, setSelectedProfessionalId] = useState(PROFESSIONALS[0]?.id ?? "");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "card" | "boleto">("pix");
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "processing" | "approved">("idle");
  const [paymentMessage, setPaymentMessage] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const selectedProfessional = useMemo(
    () => PROFESSIONALS.find((professional) => professional.id === selectedProfessionalId) ?? null,
    [selectedProfessionalId],
  );

  function handleConfirm() {
    if (!selectedProfessional || !selectedSlot) return;
    setPaymentStatus("processing");
    setPaymentMessage("Processando pagamento...");
    setConfirmed(false);

    window.setTimeout(() => {
      setPaymentStatus("approved");
      setPaymentMessage(
        `Pagamento aprovado via ${
          paymentMethod === "pix" ? "PIX" : paymentMethod === "card" ? "Cartao" : "Boleto"
        }.`,
      );
      setConfirmed(true);
    }, 1000);
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-sky-100 bg-gradient-to-r from-sky-50 to-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Agendar consulta</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Escolha a psicologa e confirme</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Ambiente mockado funcional para o paciente escolher profissional, horario e confirmar o agendamento.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_minmax(0,1fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">1. Selecione a profissional</p>
          <div className="mt-3 space-y-3">
            {PROFESSIONALS.map((professional) => {
              const isActive = professional.id === selectedProfessionalId;
              return (
                <button
                  key={professional.id}
                  type="button"
                  onClick={() => {
                    setSelectedProfessionalId(professional.id);
                    setSelectedSlot("");
                    setConfirmed(false);
                  }}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    isActive
                      ? "border-sky-300 bg-sky-50"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-900">{professional.name}</p>
                  <p className="text-xs text-slate-600">{professional.specialty}</p>
                  <p className="mt-1 text-xs font-semibold text-sky-700">
                    R$ {professional.price.toFixed(2).replace(".", ",")}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">2. Escolha horario e forma de pagamento</p>
          {selectedProfessional ? (
            <div className="mt-3 space-y-2">
              {selectedProfessional.slots.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => {
                    setSelectedSlot(slot);
                    setConfirmed(false);
                  }}
                  className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                    selectedSlot === slot
                      ? "border-sky-300 bg-sky-50 text-sky-800"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {slot}
                </button>
              ))}
            </div>
          ) : null}

          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Forma de pagamento</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {[
                { id: "pix", label: "PIX" },
                { id: "card", label: "Cartao" },
                { id: "boleto", label: "Boleto" },
              ].map((method) => (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => {
                    setPaymentMethod(method.id as "pix" | "card" | "boleto");
                    setConfirmed(false);
                    setPaymentStatus("idle");
                    setPaymentMessage("");
                  }}
                  className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                    paymentMethod === method.id
                      ? "border-sky-300 bg-sky-50 text-sky-800"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {method.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedProfessional || !selectedSlot || paymentStatus === "processing"}
            className="mt-5 w-full rounded-full bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {paymentStatus === "processing" ? "Processando pagamento..." : "Pagar e confirmar agendamento"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">Resumo do agendamento</p>
        {selectedProfessional && selectedSlot ? (
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            <p>
              <span className="font-semibold">Profissional:</span> {selectedProfessional.name}
            </p>
            <p>
              <span className="font-semibold">Especialidade:</span> {selectedProfessional.specialty}
            </p>
            <p>
              <span className="font-semibold">Horario:</span> {selectedSlot}
            </p>
            <p>
              <span className="font-semibold">Valor:</span> R$ {selectedProfessional.price.toFixed(2).replace(".", ",")}
            </p>
            <p>
              <span className="font-semibold">Pagamento:</span>{" "}
              {paymentMethod === "pix" ? "PIX" : paymentMethod === "card" ? "Cartao" : "Boleto"}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">Selecione profissional e horario para gerar o resumo.</p>
        )}

        {paymentMessage ? (
          <p
            className={`mt-4 rounded-lg px-3 py-2 text-sm font-medium ${
              paymentStatus === "approved"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border border-sky-200 bg-sky-50 text-sky-700"
            }`}
          >
            {paymentMessage}
          </p>
        ) : null}

        {confirmed ? (
          <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
            Consulta confirmada com sucesso! Seu horario ja aparece como reservado no portal (mock).
          </p>
        ) : null}
      </section>
    </div>
  );
}
