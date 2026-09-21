import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "https://growth.ucc.edu.gh";
  return {
    rules: [
      { userAgent: "*", allow: ["/", "/verify-credential", "/privacy", "/terms", "/accessibility", "/refund-policy", "/support"], disallow: ["/api/", "/admin-signin", "/facilitator-signin", "/student-signin", "/student-registration", "/facilitator-studio", "/fsadmin"] },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
