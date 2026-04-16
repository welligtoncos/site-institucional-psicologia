"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Offer = {
  id: string;
  psychologist: string;
  specialty: string;
  price: number;
  duration: string;
  format: string;
  nextSlot: string;
  description: string;
};

const OFFERS: Offer[] = [
  {
    id: "of-1",
    psychologist: "Dra. Ana Clara",
    specialty: "Ansiedade e estresse",
    price: 190,
    duration: "50 min",
    format: "Online e Presencial",
    nextSlot: "Seg, 06/05 - 14:00",
    description: "Atendimento focado em regulação emocional, manejo de ansiedade e rotina de autocuidado.",
  },
  {
    id: "of-2",
    psychologist: "Dra. Beatriz Lima",
    specialty: "Terapia de casal",
    price: 240,
    duration: "60 min",
    format: "Presencial",
    nextSlot: "Qua, 08/05 - 19:00",
    description: "Sessões para melhorar comunicação, reconexão afetiva e resolução de conflitos no relacionamento.",
  },
  {
    id: "of-3",
    psychologist: "Dr. Rafael Souza",
    specialty: "Depressão e luto",
    price: 210,
    duration: "50 min",
    format: "Online",
    nextSlot: "Sex, 10/05 - 10:30",
    description: "Acompanhamento acolhedor para reorganização emocional em fases de perda e tristeza persistente.",
  },
];

export function OffersBoard() {
  const [specialtyFilter, setSpecialtyFilter] = useState("todas");
  const specialties = useMemo(
    () => ["todas", ...Array.from(new Set(OFFERS.map((item) => item.specialty)))],
    [],
  );

  const visibleOffers = useMemo(() => {
    if (specialtyFilter === "todas") return OFFERS;
    return OFFERS.filter((item) => item.specialty === specialtyFilter);
  }, [specialtyFilter]);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-sky-100 bg-gradient-to-r from-sky-50 to-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Ofertas de consulta</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Escolha a consulta ideal para voce</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Veja valores, especialidade e profissional de forma transparente. Este ambiente e um mock funcional para
          apresentar planos de atendimento ao paciente.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {specialties.map((specialty) => (
            <button
              key={specialty}
              type="button"
              onClick={() => setSpecialtyFilter(specialty)}
              className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] transition ${
                specialtyFilter === specialty
                  ? "border-sky-300 bg-sky-50 text-sky-800"
                  : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {specialty}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleOffers.map((offer) => (
          <article key={offer.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">{offer.specialty}</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">{offer.psychologist}</h2>
            <p className="mt-2 text-sm text-slate-600">{offer.description}</p>

            <dl className="mt-4 space-y-2 text-sm text-slate-700">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Valor</dt>
                <dd className="font-semibold text-slate-900">R$ {offer.price.toFixed(2).replace(".", ",")}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Duracao</dt>
                <dd className="font-medium">{offer.duration}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Formato</dt>
                <dd className="font-medium">{offer.format}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Proximo horario</dt>
                <dd className="font-medium">{offer.nextSlot}</dd>
              </div>
            </dl>

            <Link
              href="/portal/agendar"
              className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700"
            >
              Quero agendar com essa profissional
            </Link>
          </article>
        ))}
      </section>
    </div>
  );
}
