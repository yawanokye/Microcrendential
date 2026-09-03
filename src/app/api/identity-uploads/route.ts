import { getChatGPTUser } from "@/app/chatgpt-auth";
import { deleteStoredFile, getStoredMetadata, putStoredFile } from "@/lib/render-storage";

const ALLOWED_ID_TYPES = new Set(["image/jpeg", "image/png", "application/pdf"]);
const ALLOWED_SELFIE_TYPES = new Set(["image/jpeg", "image/png"]);

const resolvedType = async (file: File) => {
  const header = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
  if (header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) return "image/jpeg";
  if (header.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => header[index] === value)) return "image/png";
  const text = new TextDecoder("latin1").decode(header);
  if (text.includes("%PDF-")) return "application/pdf";
  return "";
};

export async function POST(request: Request) {
  const identity = await getChatGPTUser();
  if (!identity) return Response.json({ error: "Sign in is required." }, { status: 401 });
  const form = await request.formData();
  const file = form.get("file");
  const kind = form.get("kind") === "selfie" ? "selfie" : "national-id";
  if (!(file instanceof File)) return Response.json({ error: "Choose a file to upload." }, { status: 400 });
  const allowed = kind === "selfie" ? ALLOWED_SELFIE_TYPES : ALLOWED_ID_TYPES;
  const contentType = await resolvedType(file);
  if (!allowed.has(contentType)) return Response.json({ error: kind === "selfie" ? "The live photo must be JPG or PNG." : "The ID must be a JPG, PNG or PDF." }, { status: 415 });
  if (file.size === 0) return Response.json({ error: "The selected file is empty. Choose the completed scan again." }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) return Response.json({ error: "Identity files must be 8 MB or smaller." }, { status: 413 });
  const key = await putStoredFile(`identity-verification/${kind}`, file, { contentType, ownerEmail: identity.email.toLowerCase(), evidenceKind: kind, originalName: file.name });
  return Response.json({ key, name: file.name, type: contentType, size: file.size });
}

export async function DELETE(request: Request) {
  const identity = await getChatGPTUser();
  if (!identity) return Response.json({ error: "Sign in is required." }, { status: 401 });
  const payload = await request.json().catch(() => null) as { key?: string } | null;
  const key = payload?.key?.trim() ?? "";
  if (!key.startsWith("identity-verification/")) return Response.json({ error: "A valid identity upload is required." }, { status: 400 });
  try {
    const metadata = await getStoredMetadata(key);
    if (metadata.ownerEmail?.toLowerCase() !== identity.email.toLowerCase()) return Response.json({ error: "You cannot remove this upload." }, { status: 403 });
    await deleteStoredFile(key);
    return Response.json({ removed: true });
  } catch {
    return Response.json({ error: "That upload is no longer available." }, { status: 404 });
  }
}
