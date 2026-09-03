import { getChatGPTUser } from "@/app/chatgpt-auth";
import { putStoredFile } from "@/lib/render-storage";

const ALLOWED_ID_TYPES = new Set(["image/jpeg", "image/png", "application/pdf"]);
const ALLOWED_SELFIE_TYPES = new Set(["image/jpeg", "image/png"]);

export async function POST(request: Request) {
  const identity = await getChatGPTUser();
  if (!identity) return Response.json({ error: "Sign in is required." }, { status: 401 });
  const form = await request.formData();
  const file = form.get("file");
  const kind = form.get("kind") === "selfie" ? "selfie" : "national-id";
  if (!(file instanceof File)) return Response.json({ error: "Choose a file to upload." }, { status: 400 });
  const allowed = kind === "selfie" ? ALLOWED_SELFIE_TYPES : ALLOWED_ID_TYPES;
  if (!allowed.has(file.type)) return Response.json({ error: kind === "selfie" ? "The live photo must be JPG or PNG." : "The ID must be a JPG, PNG or PDF." }, { status: 415 });
  if (file.size > 8 * 1024 * 1024) return Response.json({ error: "Identity files must be 8 MB or smaller." }, { status: 413 });
  const key = await putStoredFile(`identity-verification/${kind}`, file, { contentType: file.type, ownerEmail: identity.email.toLowerCase(), evidenceKind: kind, originalName: file.name });
  return Response.json({ key, name: file.name, type: file.type, size: file.size });
}
