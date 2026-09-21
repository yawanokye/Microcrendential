import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "https://growth.ucc.edu.gh";
  return ["", "/verify-credential", "/privacy", "/terms", "/accessibility", "/refund-policy", "/support"].map((path) => ({ url: `${base}${path}`, lastModified: new Date("2026-09-21"), changeFrequency: path ? "monthly" : "weekly", priority: path ? 0.7 : 1 }));
}
