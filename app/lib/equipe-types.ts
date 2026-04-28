/** Modelo já normalizado para o cliente (URLs de imagem e moeda formatada). */

export type EquipeAgendaDay = {
  date: string;
  weekday_label: string;
  slots: string[];
};

export type EquipeCardModel = {
  id: string;
  nome: string;
  crp: string;
  bio: string;
  valorConsultaLabel: string;
  duracaoMinutos: number;
  fotoSrc: string | null;
  especialidades: string[];
  agendaDays: EquipeAgendaDay[];
};
