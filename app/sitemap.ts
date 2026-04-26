import type { MetadataRoute } from "next";

const baseUrl = "https://psicologoonlineja.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "",
    "/sobre",
    "/especialidades",
    "/equipe",
  ] as const;

  const now = new Date();

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.7,
  }));
}
