import type { Metadata } from "next";
import { AvailabilityAdminPanel } from "@/app/components/admin/AvailabilityAdminPanel";
import { Container, Section } from "@/app/components/ui/SitePrimitives";

export const metadata: Metadata = {
  title: "Admin Agenda",
  description: "Painel interno para gerenciar disponibilidade de horarios.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminAgendaPage() {
  return (
    <Section>
      <Container>
        <div className="mb-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Area interna</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Painel admin de disponibilidade
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Gerencie os horarios de atendimento de forma simples. As datas sao geradas
            automaticamente de forma progressiva e voce decide quais horarios ficam disponiveis.
          </p>
        </div>

        <AvailabilityAdminPanel />
      </Container>
    </Section>
  );
}
