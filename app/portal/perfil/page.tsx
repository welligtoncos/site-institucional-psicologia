import type { Metadata } from "next";

import { PatientProfileForm } from "@/app/components/portal/PatientProfileForm";

export const metadata: Metadata = {
  title: "Meu perfil",
  description:
    "Meu perfil no portal: complete ou atualize nome, telefone, CPF e demais dados cadastrais da clínica.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PortalProfilePage() {
  return <PatientProfileForm />;
}
