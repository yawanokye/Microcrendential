import { getRawDb } from "@/db/raw";
import { verificationQrSvg } from "@/lib/qr-code";

function publicOrigin(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.RENDER_EXTERNAL_URL;
  if (configured) {
    try { return new URL(configured).origin; } catch { /* Fall back to forwarded request headers. */ }
  }
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0].trim();
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  if (forwardedHost && /^(https?)$/.test(forwardedProtocol || "https")) return `${forwardedProtocol || "https"}://${forwardedHost}`;
  return new URL(request.url).origin;
}

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code")?.trim().toUpperCase() ?? "";
  if (!/^UCC[A-Z0-9-]{8,40}$/.test(code)) return Response.json({ error: "A valid certificate code is required." }, { status: 400 });
  const exists = await getRawDb().prepare("SELECT certificate_code FROM certificates WHERE certificate_code = ? LIMIT 1").bind(code).first();
  if (!exists) return Response.json({ error: "Certificate was not found." }, { status: 404 });
  const verificationUrl = `${publicOrigin(request)}/verify-credential?code=${encodeURIComponent(code)}`;
  try {
    return new Response(verificationQrSvg(verificationUrl), {
      headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=3600", "x-content-type-options": "nosniff" },
    });
  } catch {
    return Response.json({ error: "The verification link is too long to encode." }, { status: 500 });
  }
}
