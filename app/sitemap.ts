import type { MetadataRoute } from "next";
import { siteConfig } from "@/app/lib/site";

type PublicRoute = {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
};

const sitemapBatches: PublicRoute[][] = [
  [
    { path: "/", changeFrequency: "weekly", priority: 1 },
    { path: "/sobre", changeFrequency: "monthly", priority: 0.8 },
    { path: "/especialidades", changeFrequency: "weekly", priority: 0.9 },
    { path: "/equipe", changeFrequency: "monthly", priority: 0.8 },
  ],
  [
    { path: "/ansiedade", changeFrequency: "monthly", priority: 0.8 },
    { path: "/depressao", changeFrequency: "monthly", priority: 0.8 },
    { path: "/terapia-de-casal", changeFrequency: "monthly", priority: 0.8 },
    { path: "/autoestima", changeFrequency: "monthly", priority: 0.8 },
  ],
];

export function generateSitemaps() {
  return sitemapBatches.map((_, id) => ({ id }));
}

export default async function sitemap(props: { id: number }): Promise<MetadataRoute.Sitemap> {
  const currentBatch = sitemapBatches[props.id] ?? [];
  const now = new Date();

  return currentBatch.map((route) => ({
    url: `${siteConfig.siteUrl}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
