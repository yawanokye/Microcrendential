import { requireActiveProfile } from "@/lib/accounts";
import { recordAudit } from "@/lib/audit";
import { getRawDb } from "@/db/raw";
import { getStoredFile, putStoredFile } from "@/lib/render-storage";
import { rejectCrossSiteMutation } from "@/lib/request-security";
import { validateCertificateImage } from "@/lib/file-security";

const validKey = (key: string) => /^certificate-branding\/[a-zA-Z0-9/_\-.]+$/.test(key);

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key")?.trim() ?? "";
  if (!validKey(key)) return Response.json({ error: "Invalid certificate asset reference." }, { status: 400 });

  const publicReference = await getRawDb().prepare(`SELECT id FROM certificates
    WHERE status = 'active' AND (partner_logo_key = ? OR partner_signature_key = ?) LIMIT 1`).bind(key, key).first();
  if (!publicReference) {
    const staff = await requireActiveProfile(["facilitator", "admin"]);
    if (staff.error) return Response.json({ error: "Certificate asset not found." }, { status: 404 });
  }

  try {
    const stored = await getStoredFile(key);
    if (!["certificate-partner-logo", "certificate-partner-signature"].includes(stored.metadata.evidenceKind ?? "")) throw new Error("Invalid asset kind");
    return new Response(stored.body, { headers: {
      "content-type": stored.metadata.contentType,
      "cache-control": "private, max-age=300",
      "content-disposition": "inline",
      "x-content-type-options": "nosniff",
    } });
  } catch {
    return Response.json({ error: "Certificate asset not found." }, { status: 404 });
  }
}

export async function POST(request: Request) {
  const originError = rejectCrossSiteMutation(request); if (originError) return originError;
  const account = await requireActiveProfile(["facilitator", "admin"]);
  if (account.error || !account.profile) return account.error;
  const form = await request.formData();
  const file = form.get("file");
  const assetType = String(form.get("assetType") ?? "");
  if (!(file instanceof File)) return Response.json({ error: "Choose an image file." }, { status: 400 });
  if (!['partner_logo', 'partner_signature'].includes(assetType)) return Response.json({ error: "Choose a valid certificate asset type." }, { status: 400 });
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) {
    return Response.json({ error: "Use PNG, JPEG or WebP no larger than 2 MB." }, { status: 400 });
  }
  if (!await validateCertificateImage(file)) return Response.json({ error: "The certificate image contents do not match the selected format." }, { status: 415 });
  const evidenceKind = assetType === "partner_logo" ? "certificate-partner-logo" : "certificate-partner-signature";
  const key = await putStoredFile("certificate-branding", file, { contentType: file.type, originalName: file.name, ownerEmail: account.profile.email, evidenceKind });
  await recordAudit(account.profile.email, "certificate.branding_uploaded", { assetType, fileName: file.name });
  return Response.json({ key, imageUrl: `/api/certificate-branding?key=${encodeURIComponent(key)}` }, { status: 201 });
}
