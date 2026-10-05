import { getRawDb } from "@/db/raw";
import { createCertificatePdf, type CertificatePdfRecord } from "@/lib/certificate-pdf";
import { safeCertificateFilename } from "@/lib/certificate-policy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const columns = "certificate_code,learner_name,course_code,course_title,credential_type,status,issued_at,expires_at,award_type,issuance_model,partner_name,partner_logo_key,partner_signatory_name,partner_signatory_title,partner_signature_key,cpd_hours,cpd_points,professional_approval_body,professional_approval_reference,show_academic_lead,facilitator_name,facilitator_title,facilitator_signature_key,provost_name,provost_title,provost_signature_key";

type DownloadableCertificate = CertificatePdfRecord & { status: string };

function publicOrigin(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.RENDER_EXTERNAL_URL;
  if (configured) {
    try { return new URL(configured).origin; } catch { /* Fall back to the request. */ }
  }
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0].trim();
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  if (forwardedHost && /^(https?)$/.test(forwardedProtocol || "https")) return `${forwardedProtocol || "https"}://${forwardedHost}`;
  return new URL(request.url).origin;
}

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code")?.trim().toUpperCase() ?? "";
  if (!/^UCC[A-Z0-9-]{8,40}$/.test(code)) return Response.json({ error: "A valid certificate code is required." }, { status: 400 });
  const certificate = await getRawDb().prepare(`SELECT ${columns} FROM certificates WHERE certificate_code = ? LIMIT 1`).bind(code).first<DownloadableCertificate>();
  if (!certificate) return Response.json({ error: "Certificate was not found." }, { status: 404 });
  const expired = Boolean(certificate.expires_at && Date.parse(certificate.expires_at) < Date.now());
  if (certificate.status !== "active" || expired) return Response.json({ error: expired ? "This credential has expired." : "This credential is not currently valid." }, { status: 410 });
  const verificationUrl = `${publicOrigin(request)}/verify-credential?code=${encodeURIComponent(code)}`;
  const pdf = await createCertificatePdf(certificate, verificationUrl);
  const filename = safeCertificateFilename(certificate.course_code);
  const body = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;
  return new Response(body, { headers: {
    "content-type": "application/pdf",
    "content-disposition": `attachment; filename="${filename}"`,
    "content-length": String(pdf.byteLength),
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff",
  } });
}
