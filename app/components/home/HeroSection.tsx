import { ActionLink, Container } from "../ui/SitePrimitives";
import { loadEquipePsychologists } from "@/app/lib/server/equipe-backend";

export async function HeroSection() {
  const equipeResult = await loadEquipePsychologists(7);
  const vagasSomadas =
    equipeResult.ok
      ? equipeResult.psychologists.reduce((total, psychologist) => {
          return total + psychologist.agendaDays.reduce((subTotal, day) => subTotal + day.slots.length, 0);
        }, 0)
      : 0;

  return (
    <section className="relative overflow-hidden border-b border-slate-200/70">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-sky-100/70 via-white to-slate-50" />

      <Container className="flex flex-col items-start gap-6 py-14 sm:py-16 lg:py-20">
        <span className="rounded-full border border-sky-200 bg-sky-100/60 px-4 py-1 text-sm font-medium text-sky-800">
          Cuidado emocional com escuta qualificada
        </span>

        <div className="max-w-3xl space-y-4">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-5xl lg:text-5xl">
            Psicologo Online Ja
          </h1>
          <p className="text-base leading-relaxed text-slate-600 sm:text-lg lg:text-xl">
            Atendimento psicologico humanizado para adolescentes, adultos e casais, com escuta profissional, plano
            terapeutico personalizado e foco em qualidade de vida.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <ActionLink href="/register" className="text-base">
            Criar conta e agendar
          </ActionLink>
          <ActionLink href="/login?next=/portal" variant="secondary" className="text-base">
            Ja tenho conta
          </ActionLink>
        </div>

        <div className="w-full max-w-3xl rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-emerald-800">
            Disponibilidades livres para atendimento psicologico
          </p>
          <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-4xl font-bold leading-none text-emerald-700 sm:text-5xl">{vagasSomadas}</p>
              <p className="mt-1 text-sm text-slate-700">nos proximos 7 dias</p>
            </div>
            <ActionLink href="/register" className="text-sm">
              Garantir minha vaga
            </ActionLink>
          </div>
        </div>

        <ul className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-3">
          <li className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2">Cadastro rapido</li>
          <li className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2">Agenda online 24h</li>
          <li className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2">Pagamento simples e seguro</li>
        </ul>
      </Container>
    </section>
  );
}
