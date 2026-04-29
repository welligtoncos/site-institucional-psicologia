import Link from "next/link";
import { SectionTitle } from "./SectionTitle";
import { Container, Section } from "../ui/SitePrimitives";
import { loadEquipePsychologists, resolveBackendAssetUrl } from "@/app/lib/server/equipe-backend";

const fallbackTeam = [
  {
    name: "Dra. Mariana Alves",
    id: null as string | null,
    role: "Psicologa clinica - CRP 00/00000",
    focus: "Ansiedade, autoestima e autoconhecimento",
    photo: null as string | null,
    specialties: "Ansiedade e autoestima",
  },
  {
    name: "Dr. Rafael Monteiro",
    id: null as string | null,
    role: "Psicologo clinico - CRP 00/00000",
    focus: "Terapia de casal e relacionamentos",
    photo: null as string | null,
    specialties: "Casal e relacionamentos",
  },
  {
    name: "Dra. Camila Nunes",
    id: null as string | null,
    role: "Psicologa clinica - CRP 00/00000",
    focus: "Adolescentes, orientacao familiar e estresse escolar",
    photo: null as string | null,
    specialties: "Adolescentes e familia",
  },
];

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "PS";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

export async function TeamSection() {
  const equipeResult = await loadEquipePsychologists();
  const team =
    equipeResult.ok && equipeResult.psychologists.length > 0
      ? equipeResult.psychologists.slice(0, 3).map((psychologist) => ({
          id: psychologist.id,
          name: psychologist.nome,
          role: `Psicologo(a) clinico(a) - CRP ${psychologist.crp}`,
          focus: psychologist.bio,
          photo: resolveBackendAssetUrl(psychologist.foto_url),
          specialties: psychologist.especialidades?.length
            ? psychologist.especialidades.slice(0, 2).join(" · ")
            : "Atendimento clinico personalizado",
        }))
      : fallbackTeam;

  return (
    <Section id="equipe" className="bg-white">
      <Container>
        <SectionTitle
          eyebrow="Equipe de psicologos"
          title="Profissionais experientes e comprometidos com seu bem-estar"
          subtitle="Nossa equipe atua com escuta tecnica, empatia e atualizacao constante para oferecer um atendimento de excelencia."
        />

        <div className="mt-8 grid gap-5 sm:mt-10 md:grid-cols-3">
          {team.map((member) => (
            <article
              key={member.name}
              className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="relative h-44 overflow-hidden bg-gradient-to-b from-sky-100 via-sky-50 to-white">
                {member.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={member.photo}
                    alt={`Foto profissional de ${member.name}`}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-sky-500 to-indigo-500 text-4xl font-bold text-white">
                    {initialsFromName(member.name)}
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-900/35 to-transparent" />
              </div>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-slate-900 break-words [overflow-wrap:anywhere]">
                  {member.name}
                </h3>
                <p className="mt-1 text-sm font-medium text-sky-700 break-words [overflow-wrap:anywhere]">{member.role}</p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{member.specialties}</p>
                <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Bio</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700 whitespace-pre-line break-words [overflow-wrap:anywhere]">
                    {member.focus}
                  </p>
                </div>
                <Link
                  href={member.id ? `/equipe?psych=${encodeURIComponent(member.id)}` : "/equipe"}
                  className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700"
                >
                  Ver horarios
                </Link>
              </div>
            </article>
          ))}
        </div>
      </Container>
    </Section>
  );
}
