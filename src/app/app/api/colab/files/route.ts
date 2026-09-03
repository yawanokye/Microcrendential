import { getRawDb } from "@/db/raw";
import { requireActiveProfile } from "@/lib/accounts";
import { getStoredFile } from "@/lib/render-storage";

export async function GET(request: Request) {
  const account = await requireActiveProfile();
  if (account.error || !account.profile) return account.error;
  const url = new URL(request.url); const assignmentId = Number(url.searchParams.get("assignmentId")); const submissionId = Number(url.searchParams.get("submissionId"));
  const db = getRawDb(); let record: { object_key: string | null; file_name: string | null } | null = null;
  if (assignmentId) {
    if (account.profile.role === "learner") record = await db.prepare("SELECT a.template_file_key AS object_key, a.template_file_name AS file_name FROM colab_assignments a JOIN enrollments e ON e.course_code = a.course_code WHERE a.id = ? AND a.status = 'active' AND e.user_email = ? AND e.status IN ('active','completed') LIMIT 1").bind(assignmentId, account.profile.email).first<{ object_key: string; file_name: string }>();
    else { const sql = account.profile.role === "admin" ? "SELECT template_file_key AS object_key, template_file_name AS file_name FROM colab_assignments WHERE id = ? LIMIT 1" : "SELECT template_file_key AS object_key, template_file_name AS file_name FROM colab_assignments WHERE id = ? AND created_by_email = ? LIMIT 1"; const statement = db.prepare(sql); record = account.profile.role === "admin" ? await statement.bind(assignmentId).first<{ object_key: string; file_name: string }>() : await statement.bind(assignmentId, account.profile.email).first<{ object_key: string; file_name: string }>(); }
  } else if (submissionId) {
    if (account.profile.role === "learner") record = await db.prepare("SELECT notebook_key AS object_key, notebook_file_name AS file_name FROM colab_submissions WHERE id = ? AND learner_email = ? LIMIT 1").bind(submissionId, account.profile.email).first<{ object_key: string | null; file_name: string | null }>();
    else { const sql = account.profile.role === "admin" ? "SELECT notebook_key AS object_key, notebook_file_name AS file_name FROM colab_submissions WHERE id = ? LIMIT 1" : "SELECT s.notebook_key AS object_key, s.notebook_file_name AS file_name FROM colab_submissions s JOIN colab_assignments a ON a.id = s.assignment_id WHERE s.id = ? AND a.created_by_email = ? LIMIT 1"; const statement = db.prepare(sql); record = account.profile.role === "admin" ? await statement.bind(submissionId).first<{ object_key: string | null; file_name: string | null }>() : await statement.bind(submissionId, account.profile.email).first<{ object_key: string | null; file_name: string | null }>(); }
  }
  if (!record?.object_key) return Response.json({ error: "Notebook file was not found or access is not permitted." }, { status: 404 });
  try {
    const stored = await getStoredFile(record.object_key); const safeName = (record.file_name || stored.metadata.originalName || "notebook.ipynb").replace(/["\r\n]/g, "-");
    return new Response(stored.body, { headers: { "content-type": stored.metadata.contentType || "application/x-ipynb+json", "cache-control": "private, no-store", "content-disposition": `attachment; filename="${safeName}"`, "x-content-type-options": "nosniff" } });
  } catch { return Response.json({ error: "Notebook file was not found." }, { status: 404 }); }
}
