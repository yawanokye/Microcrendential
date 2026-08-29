import { getRawDb } from "@/db/raw";
import { requireActiveProfile } from "@/lib/accounts";
import { getStoredFile } from "@/lib/render-storage";

export async function GET(request: Request) {
  const account = await requireActiveProfile();
  if (account.error || !account.profile) return account.error;
  const id = Number(new URL(request.url).searchParams.get("submissionId"));
  if (!id) return Response.json({ error: "Choose a practical submission." }, { status: 400 });
  const sql = account.profile.role === "learner"
    ? "SELECT evidence_key, evidence_file_name FROM virtual_lab_submissions WHERE id = ? AND learner_email = ? LIMIT 1"
    : "SELECT evidence_key, evidence_file_name FROM virtual_lab_submissions WHERE id = ? LIMIT 1";
  const statement = getRawDb().prepare(sql);
  const record = account.profile.role === "learner"
    ? await statement.bind(id, account.profile.email).first<{ evidence_key: string | null; evidence_file_name: string | null }>()
    : await statement.bind(id).first<{ evidence_key: string | null; evidence_file_name: string | null }>();
  if (!record?.evidence_key) return Response.json({ error: "Practical evidence was not found or access is not permitted." }, { status: 404 });
  try {
    const stored = await getStoredFile(record.evidence_key);
    const safeName = (record.evidence_file_name || stored.metadata.originalName || "practical-evidence").replace(/["\r\n]/g, "-");
    return new Response(stored.body, { headers: { "content-type": stored.metadata.contentType || "application/octet-stream", "cache-control": "private, no-store", "content-disposition": `inline; filename="${safeName}"`, "x-content-type-options": "nosniff" } });
  } catch { return Response.json({ error: "Practical evidence was not found." }, { status: 404 }); }
}
