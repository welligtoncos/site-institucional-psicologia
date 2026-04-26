import type { MetadataRoute } from "next";

const baseUrl = "https://psicologoonlineja.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "",
    "/sobre",
    "/especialidades",
    "/equipe",
    "/register",
    "/register/psicologo",
    "/login",
    "/portal",
    "/portal/agendar",
    "/portal/consultas",
    "/portal/consultas/sala",
    "/portal/atendimento",
    "/portal/faturamento",
    "/portal/ofertas",
    "/portal/perfil",
    "/psicologo",
    "/psicologo/agenda",
    "/psicologo/disponibilidade",
    "/psicologo/faturas",
    "/psicologo/pacientes",
    "/psicologo/perfil",
    "/psicologo/sessao",
    "/admin/agenda",
    "/payment/pending",
    "/payment/success",
    "/payment/failure",
  ] as const;

  const now = new Date();

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.7,
  }));
}
