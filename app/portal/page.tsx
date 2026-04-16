import type { Metadata } from "next";
import { PortalGate } from "@/app/components/auth/PortalGate";

export const metadata: Metadata = {
  title: "Portal",
  description: "Area interna com acesso autenticado.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PortalPage() {
  return <PortalGate />;
}
