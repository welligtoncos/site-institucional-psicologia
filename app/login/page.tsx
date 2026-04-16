import type { Metadata } from "next";
import { LoginForm } from "@/app/components/auth/LoginForm";
import { Container, Section } from "@/app/components/ui/SitePrimitives";

export const metadata: Metadata = {
  title: "Login",
  description: "Acesso ao portal interno do sistema.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LoginPage() {
  return (
    <Section>
      <Container>
        <LoginForm />
      </Container>
    </Section>
  );
}
