import { ActionLink, Container } from "../ui/SitePrimitives";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-slate-200/70">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-sky-100/70 via-white to-slate-50" />

      <Container className="flex flex-col items-start gap-7 py-16 sm:py-20 lg:py-28">
        <span className="rounded-full border border-sky-200 bg-sky-100/60 px-4 py-1 text-sm font-medium text-sky-800">
          Cuidado emocional com escuta qualificada
        </span>

        <div className="max-w-3xl space-y-4 sm:space-y-5">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            Clinica Harmonia Psicologia
          </h1>
          <p className="text-base leading-relaxed text-slate-600 sm:text-lg lg:text-xl">
            Atendimento psicologico humanizado para adolescentes, adultos e casais, com escuta
            profissional, plano terapeutico personalizado e foco em qualidade de vida.
          </p>
        </div>

        <ActionLink href="/contato" className="text-base">
          Agendar consulta
        </ActionLink>
      </Container>
    </section>
  );
}
