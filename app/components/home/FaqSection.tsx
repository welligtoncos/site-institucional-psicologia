import Link from "next/link";
import { Container, Section } from "../ui/SitePrimitives";
import { SectionTitle } from "./SectionTitle";

const faqs = [
  {
    question: "Como funciona a terapia online?",
    answer:
      "Voce cria sua conta, escolhe o profissional e agenda o horario no portal. A sessao acontece em ambiente privado com orientacoes claras para acesso.",
  },
  {
    question: "Qual e a duracao de cada sessao?",
    answer:
      "As sessoes costumam durar em media 50 minutos, com frequencia definida conforme sua necessidade e recomendacao profissional.",
  },
  {
    question: "As consultas online sao sigilosas?",
    answer:
      "Sim. O atendimento segue os principios eticos da psicologia, com sigilo profissional e boas praticas de privacidade em todo o processo.",
  },
  {
    question: "Como e feito o pagamento?",
    answer:
      "O pagamento e realizado online dentro da plataforma no momento do agendamento, com confirmacao automatica da consulta.",
  },
];

export function FaqSection() {
  return (
    <Section id="faq" className="bg-white">
      <Container>
        <SectionTitle
          eyebrow="Perguntas frequentes"
          title="Duvidas comuns sobre psicologo online"
          subtitle="Respostas objetivas para voce iniciar seu acompanhamento com mais seguranca."
          align="center"
        />
        <div className="mx-auto mt-8 grid max-w-4xl gap-4 sm:mt-10">
          {faqs.map((item) => (
            <article key={item.question} className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
              <h3 className="text-base font-semibold text-slate-900">{item.question}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.answer}</p>
            </article>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-slate-600">
          Ainda tem duvidas?{" "}
          <Link href="/register" className="font-semibold text-sky-700 underline underline-offset-2">
            Criar conta e agendar consulta
          </Link>
        </p>
      </Container>
    </Section>
  );
}
