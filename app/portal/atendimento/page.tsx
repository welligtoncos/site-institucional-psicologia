import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Atendimento ao vivo",
  description: "Área unificada em Minhas consultas.",
  robots: { index: false, follow: false },
};

export default function PortalAtendimentoPage() {
  redirect("/portal/consultas/sala");
}
