import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // /scope is the dev-only Scope mood/motion lab (see
        // src/app/scope/scope-lab.tsx) — not a real page, shouldn't be indexed.
        disallow: "/scope",
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
