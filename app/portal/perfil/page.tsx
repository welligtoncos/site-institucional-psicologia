import type { Metadata } from "next";

import { PatientProfileForm } from "@/app/components/portal/PatientProfileForm";

export const metadata: Metadata = {
  title: "Meu perfil",
  description: "Complete seus dados de cadastro no portal do paciente (demonstração no navegador).",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PortalProfilePage() {
  return <PatientProfileForm />;
}
