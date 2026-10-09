/** @type {import('next').NextConfig} */
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
    // LTI authorization supplies a nonce policy and its validated tool form target.
    source: "/((?!api/lti/authorize$).*)",
    headers: [{ key: "Content-Security-Policy", value: contentSecurityPolicy }],
  }]; },
};

export default nextConfig;
