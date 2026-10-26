import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));
export const requiredReleaseSources = [
  "src/components/learning-discovery.tsx", "src/lib/learning-discovery.ts", "src/app/learning-discovery.css", "src/app/explore/page.tsx",
  "src/lib/catalogue-policy.ts", "src/lib/catalogue-access.ts", "src/lib/catalogue-management.ts", "src/lib/learning-billing.ts",
  "src/db/catalogue-schema.ts", "src/components/catalogue-management.tsx", "src/app/api/catalogue/route.ts", "src/app/api/organisations/route.ts",
  "src/app/page.tsx", "src/app/facilitator-studio/page.tsx", "src/app/learn/page.tsx",
  "src/components/platform-home.tsx", "src/components/learning-page.tsx",
  "src/components/corporate-assessment-settings.tsx",
  "src/components/corporate-assessment-review.tsx",
  "src/components/corporate-assessment-learner.tsx",
  "src/lib/assessment-assurance-policy.ts", "src/lib/assessment-assurance.ts",
  "src/lib/programme-policy.ts", "src/lib/programmes.ts", "src/lib/programme-http.ts", "src/lib/programme-record.ts",
  "src/lib/programme-results.ts", "src/lib/programme-credentials.ts", "src/lib/programme-documents.ts", "src/lib/programme-transcript.ts", "src/lib/programme-verification.ts",
  "src/app/api/programmes/transcript/route.ts", "src/app/api/programmes/certificates/route.ts", "src/app/api/programmes/verify/route.ts", "src/app/verify-programme/page.tsx",
  "src/db/programme-schema.ts", "src/components/programme-workspace.tsx", "src/app/programmes/page.tsx", "src/app/programmes.css",
  "src/app/api/programmes/route.ts", "src/app/api/programmes/enrolments/route.ts", "src/app/api/programmes/registration/route.ts", "src/app/api/programmes/record/route.ts",
  "src/lib/passwords.ts", "src/lib/file-security.ts",
  "src/lib/learning-labs.ts", "src/lib/course-development.ts", "src/lib/python-lab-runtime.ts",
  "public/vendor/pyodide/manifest.json", "scripts/verify-python-runtime.mjs",
  "src/components/learning-lab-player.tsx", "src/components/learning-lab-author.tsx",
  "src/components/course-development-review.tsx", "src/app/learning-labs.css",
  "src/app/api/learning-labs/runtime/route.ts",
  "src/app/api/assessment-assurance/route.ts",
  "src/app/api/assessment-assurance/evidence/route.ts",
  "scripts/prepare-production.mjs", "scripts/start-production.mjs",
];

/** Run only before a source build. The production standalone server has no src tree. */
export function sourceLayoutIssues(root = projectRoot) {
  const isFile = (name) => { try { return statSync(resolve(root, name)).isFile(); } catch { return false; } };
  const issues = requiredReleaseSources.filter(name => !isFile(name)).map(name => `Missing ${name}`);
  for (const name of ["app", "pages"]) {
    if (existsSync(resolve(root, name))) issues.push(`Root ${name}/ overrides src/${name}/. Move the obsolete root copy out of the project before a native build.`);
  }
  try {
    const config = JSON.parse(readFileSync(resolve(root, "tsconfig.json"), "utf8"));
    if (JSON.stringify(config.compilerOptions?.paths?.["@/*"]) !== JSON.stringify(["./src/*"])) issues.push('tsconfig.json must map @/* to ["./src/*"].');
    if ((config.include || []).some(pattern => /^(?:\.\/)?(?:components|app|lib)(?:\/|$)/.test(pattern) || /^(?:\.\/)?\*\*/.test(pattern))) issues.push("tsconfig.json includes obsolete root application copies. Restore the release tsconfig.json, which checks src/.");
  } catch { issues.push("Missing or invalid tsconfig.json. Restore the release configuration."); }
  return issues;
}

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "media-src 'self' blob: https:",
  "connect-src 'self' https:",
  "frame-src 'self' https:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig = {
  output: "standalone",
  experimental: { cpus: 2, webpackMemoryOptimizations: true },
  serverExternalPackages: ["pdfjs-dist"],
  outputFileTracingIncludes: { "/api/course-ai/design": ["./node_modules/pdfjs-dist/legacy/build/*.mjs", "./node_modules/@napi-rs/canvas*/**/*"] },
  poweredByHeader: false,
  // Keep saved course/lesson links without bracketed upload folder names.
  async rewrites() { return [{
    source: "/learn/:courseCode/:lesson*",
    // Unused source parameters are passed as query values by Next.js.
    destination: "/learn",
  }]; },
  async headers() { return [{ source: "/:path*", headers: [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
    { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
    { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
    { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  ] }, {
    // LTI authorization and the isolated lab runner supply their own restricted policies.
    source: "/((?!api/lti/authorize$|api/learning-labs/runtime$).*)",
    headers: [{ key: "Content-Security-Policy", value: contentSecurityPolicy }],
  }, { source: "/api/learning-labs/runtime", headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }] }, { source: "/api/learning-labs/python/:path*", headers: [{ key: "Access-Control-Allow-Origin", value: "*" }, { key: "Cross-Origin-Resource-Policy", value: "cross-origin" }] }]; },
};

export default function configuration(phase) {
  if (phase === "phase-production-build") {
    const issues = sourceLayoutIssues();
    if (issues.length) throw new Error("Release source check failed:\n" + issues.map(issue => `- ${issue}`).join("\n") + "\nExtract the complete release ZIP and upload its src/ and scripts/ folders at the repository root. Keep every subfolder. See DEPLOYMENT-FIX-v13.3.1.md.");
  }
  return nextConfig;
}
