import type { MetadataRoute } from "next";
import { siteConfig } from "@/app/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/portal/", "/psicologo/", "/admin/", "/api/", "/login", "/register", "/payment/"],
      },
    ],
    host: siteConfig.siteUrl,
    sitemap: `${siteConfig.siteUrl}/sitemap.xml`,
  };
}
