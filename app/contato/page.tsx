import type { Metadata } from "next";
import { AppointmentRequestForm } from "../components/forms/AppointmentRequestForm";
import { PageHero } from "../components/internal/PageHero";
import { Container, Section } from "../components/ui/SitePrimitives";
import { getProgressiveAvailability } from "../lib/server/availability-store";
import { siteConfig } from "../lib/site";

export const metadata: Metadata = {
  title: "Contato",
  description:
    "Entre em contato com a Clinica Harmonia para agendar sua consulta presencial ou online.",
};

export default async function ContatoPage() {
  const availability = await getProgressiveAvailability();

  return (
    <>
      <PageHero
        eyebrow="Contato"
        title="Agende seu atendimento com a Clinica Harmonia"
        description="Fale com nossa equipe para tirar duvidas, verificar horarios e iniciar seu acompanhamento psicologico com seguranca e acolhimento."
      />

      <Section>
        <Container className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-semibold text-slate-900">Solicitar agendamento</h2>
            <p className="mt-2 text-slate-600">
              Preencha os dados abaixo e retornaremos com opcoes de horario e orientacoes para o
              primeiro atendimento.
            </p>

            <AppointmentRequestForm availability={availability} />
          </article>

          <aside className="space-y-4">
            <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Atendimento presencial</h3>
              <p className="mt-2 text-slate-600">{siteConfig.address}</p>
            </article>

            <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Atendimento online</h3>
              <p className="mt-2 text-slate-600">
                Consultas por videochamada com a mesma qualidade tecnica e sigilo profissional.
              </p>
            </article>

            <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Canais de contato</h3>
              <p className="mt-2 text-slate-600">{siteConfig.phoneDisplay}</p>
              <p className="mt-1 text-slate-600">{siteConfig.email}</p>
              <a
                href={siteConfig.whatsappHref}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
              >
                Conversar no WhatsApp
              </a>
            </article>
          </aside>
        </Container>
      </Section>

      <Section className="pt-0">
        <Container>
          <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="p-7 sm:p-8">
                <h2 className="text-2xl font-semibold text-slate-900">Localizacao da clinica</h2>
                <p className="mt-3 leading-relaxed text-slate-600">
                  Estamos em uma regiao de facil acesso, proxima ao transporte publico e com
                  estacionamento conveniado.
                </p>
                <ul className="mt-6 space-y-2 text-sm text-slate-600">
                  <li>Endereco: {siteConfig.address}</li>
                  <li>Referencia: Proximo a Praca Central</li>
                  <li>Horario: {siteConfig.businessHours}</li>
                </ul>
              </div>

              <div className="min-h-72 border-t border-slate-200 lg:min-h-full lg:border-l lg:border-t-0">
                <iframe
                  title="Mapa da Clinica Harmonia"
                  src="https://www.google.com/maps?q=Rua%20do%20Acolhimento%20245%20Centro&output=embed"
                  className="h-full min-h-72 w-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </div>
          </article>
        </Container>
      </Section>
    </>
  );
}
