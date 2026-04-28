import type { Metadata } from "next";

import { TeamQuickDirectory } from "../components/equipe/TeamQuickDirectory";
import { AppointmentCta } from "../components/internal/AppointmentCta";
import { PageHero } from "../components/internal/PageHero";
import { Container, Section } from "../components/ui/SitePrimitives";
import type { EquipeCardModel } from "../lib/equipe-types";
import { formatBrlFromApi, loadEquipePsychologists } from "../lib/server/equipe-backend";

/** Alinhado ao cache das chamadas fetch em `loadEquipePsychologists`. */
export const revalidate = 120;

export const metadata: Metadata = {
  title: "Agenda e valores da equipe",
  description:
    "Veja valor da sessao e horarios com vaga por psicologo. Agende e pague com seguranca no portal apos cadastro ou login.",
  alternates: {
    canonical: "/equipe",
  },
};

export default async function EquipePage() {
  const result = await loadEquipePsychologists(14);

  if (!result.ok) {
    return (
      <>
        <PageHero
          eyebrow="Equipe"
          title="Agenda e valores — busca rapida"
          description="Os dados sao carregados do sistema da clinica em tempo real."
        />
        <Section>
          <Container>
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center shadow-sm">
              <p className="text-sm font-semibold text-amber-950">Nao foi possivel carregar a agenda agora.</p>
              <p className="mt-2 text-sm text-amber-900/90">{result.message}</p>
              <p className="mt-4 text-xs text-amber-900/80">
                Verifique se a API esta no ar e se <code className="rounded bg-white/80 px-1">BACKEND_API_URL</code>{" "}
                aponta para o servidor correto.
              </p>
            </div>
          </Container>
        </Section>
      </>
    );
  }

  const cards: EquipeCardModel[] = result.psychologists.map((p) => ({
    id: p.id,
    nome: p.nome,
    crp: p.crp,
    bio: p.bio,
    valorConsultaLabel: formatBrlFromApi(String(p.valor_consulta)),
    duracaoMinutos: p.duracao_minutos,
    fotoSrc: p.foto_url ? `/api/public/psychologist/${p.id}/foto` : null,
    especialidades: p.especialidades,
    agendaDays: p.agendaDays,
  }));

  return (
    <>
      <PageHero
        eyebrow="Equipe"
        title="Agenda e valores — busca rapida"
        description="Abaixo voce confere o valor da sessao e os dias e horarios que ainda tem vaga — informacao atualizada como no atendimento da clinica. Para escolher o horario com certeza e pagar com seguranca, use o portal do paciente apos criar sua conta ou entrar com seu login."
      />

      <Section>
        <Container>
          <TeamQuickDirectory
            psychologists={cards}
            registerUrl="/register"
            bookUrl="/login?next=/portal/agendar&focus=email"
          />
        </Container>
      </Section>

      <AppointmentCta
        title="Pronto para escolher data e horario?"
        description="Crie seu cadastro ou entre no portal para concluir o agendamento com pagamento e confirmacao oficial."
      />
    </>
  );
}
