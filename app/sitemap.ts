import type { MetadataRoute } from "next";
import { siteConfig } from "@/app/lib/site";

type PublicRoute = {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
};

const publicRoutes: PublicRoute[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/sobre", changeFrequency: "monthly", priority: 0.8 },
  { path: "/especialidades", changeFrequency: "weekly", priority: 0.9 },
  { path: "/equipe", changeFrequency: "monthly", priority: 0.8 },
  { path: "/ansiedade", changeFrequency: "monthly", priority: 0.8 },
  { path: "/depressao", changeFrequency: "monthly", priority: 0.8 },
  { path: "/terapia-de-casal", changeFrequency: "monthly", priority: 0.8 },
  { path: "/autoestima", changeFrequency: "monthly", priority: 0.8 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return publicRoutes.map((route) => ({
    url: `${siteConfig.siteUrl}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
