import { getRawDb } from "@/db/raw";
import { requireActiveProfile } from "@/lib/accounts";
import { getStoredFile } from "@/lib/render-storage";

export async function GET(request: Request) {
  const account = await requireActiveProfile(["admin", "facilitator"]);
  if (account.error || !account.profile) return account.error;
  const url = new URL(request.url);
  const email = url.searchParams.get("email")?.trim().toLowerCase() ?? "";
  const kind = url.searchParams.get("kind") === "selfie" ? "selfie_key" : "id_document_key";
  const sql = account.profile.role === "admin" ? `SELECT ${kind} AS object_key FROM users WHERE email = ? LIMIT 1` : `SELECT ${kind} AS object_key FROM users WHERE email = ? AND verifier_email = ? LIMIT 1`;
  const statement = getRawDb().prepare(sql);
  const record = account.profile.role === "admin" ? await statement.bind(email).first<{ object_key: string | null }>() : await statement.bind(email, account.profile.email).first<{ object_key: string | null }>();
  if (!record?.object_key) return Response.json({ error: "Identity evidence was not found." }, { status: 404 });
  try { const object = await getStoredFile(record.object_key); return new Response(object.body, { headers: { "content-type": object.metadata.contentType || "application/octet-stream", "cache-control": "private, no-store", "content-disposition": "inline", "x-content-type-options": "nosniff" } }); }
  catch { return Response.json({ error: "Identity evidence was not found." }, { status: 404 }); }
}
