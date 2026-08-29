import { getRawDb } from "@/db/raw";
import { requireActiveProfile } from "@/lib/accounts";
import { getVirtualPractical, virtualPracticals } from "@/lib/virtual-labs";
import { putStoredFile } from "@/lib/render-storage";

type SubmissionRow = {
  id: number; practical_id: string; discipline: string; practical_title: string; learner_email: string; learner_name: string | null;
  attempt_number: number; observations_json: string; answers_json: string; report: string; evidence_file_name: string | null;
  status: string; mark: number | null; passed: number; feedback: string; competency_note: string; submitted_at: string; assessed_at: string | null;
};

function parseJson<T>(value: string, fallback: T) { try { return JSON.parse(value) as T; } catch { return fallback; } }
function present(row: SubmissionRow) {
  return {
    id: row.id, practicalId: row.practical_id, discipline: row.discipline, practicalTitle: row.practical_title,
    learnerEmail: row.learner_email, learnerName: row.learner_name ?? row.learner_email, attemptNumber: row.attempt_number,
    observations: parseJson<unknown[]>(row.observations_json, []), answers: parseJson<Record<string, unknown>>(row.answers_json, {}),
    report: row.report, evidenceFileName: row.evidence_file_name, status: row.status, mark: row.mark, passed: Boolean(row.passed),
    feedback: row.feedback, competencyNote: row.competency_note, submittedAt: row.submitted_at, assessedAt: row.assessed_at,
  };
}

export async function GET() {
  const account = await requireActiveProfile();
  if (account.error || !account.profile) return account.error;
  const db = getRawDb();
  const base = `SELECT s.*, u.full_name AS learner_name FROM virtual_lab_submissions s LEFT JOIN users u ON u.email = s.learner_email`;
  const rows = account.profile.role === "learner"
    ? await db.prepare(`${base} WHERE s.learner_email = ? ORDER BY s.submitted_at DESC`).bind(account.profile.email).all<SubmissionRow>()
    : await db.prepare(`${base} ORDER BY CASE s.status WHEN 'submitted' THEN 0 WHEN 'resubmit' THEN 1 ELSE 2 END, s.submitted_at DESC`).all<SubmissionRow>();
  return Response.json({ practicals: virtualPracticals, submissions: rows.results.map(present) });
}

export async function POST(request: Request) {
  const account = await requireActiveProfile(["learner"]);
  if (account.error || !account.profile) return account.error;
  const form = await request.formData();
  const practicalId = String(form.get("practicalId") ?? "").trim();
  const practical = getVirtualPractical(practicalId);
  if (!practical) return Response.json({ error: "Choose a recognised virtual practical." }, { status: 400 });
  const report = String(form.get("report") ?? "").trim();
  if (report.length < 40) return Response.json({ error: "Provide a practical report of at least 40 characters." }, { status: 400 });
  const observationsValue = String(form.get("observations") ?? "[]");
  const answersValue = String(form.get("answers") ?? "{}");
  let observations: unknown[]; let answers: Record<string, unknown>;
  try { observations = JSON.parse(observationsValue) as unknown[]; answers = JSON.parse(answersValue) as Record<string, unknown>; if (!Array.isArray(observations) || !answers || typeof answers !== "object") throw new Error(); }
  catch { return Response.json({ error: "The practical observations could not be read." }, { status: 400 }); }
  if (observations.length < 1) return Response.json({ error: "Record at least one trial or observation before submitting." }, { status: 400 });
  const db = getRawDb();
  const previous = await db.prepare("SELECT COUNT(*) AS count FROM virtual_lab_submissions WHERE practical_id = ? AND learner_email = ?").bind(practical.id, account.profile.email).first<{ count: number }>();
  const attemptNumber = Number(previous?.count ?? 0) + 1;
  if (attemptNumber > 3) return Response.json({ error: "You have used all three submission attempts for this practical." }, { status: 409 });
  const evidence = form.get("evidence");
  let evidenceKey: string | null = null; let evidenceFileName: string | null = null;
  if (evidence instanceof File && evidence.size > 0) {
    const permitted = evidence.type.startsWith("video/") || evidence.type.startsWith("image/") || evidence.type === "application/pdf";
    if (!permitted) return Response.json({ error: "Evidence must be a video, image or PDF file." }, { status: 400 });
    if (evidence.size > 25 * 1024 * 1024) return Response.json({ error: "Practical evidence must be 25 MB or smaller." }, { status: 413 });
    evidenceKey = await putStoredFile(`virtual-lab-evidence/${practical.id}`, evidence, { contentType: evidence.type || "application/octet-stream", originalName: evidence.name, ownerEmail: account.profile.email, evidenceKind: practical.id });
    evidenceFileName = evidence.name;
  }
  const result = await db.prepare(`
    INSERT INTO virtual_lab_submissions
      (practical_id, discipline, practical_title, learner_email, attempt_number, observations_json, answers_json, report, evidence_key, evidence_file_name, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted')
  `).bind(practical.id, practical.discipline, practical.title, account.profile.email, attemptNumber, JSON.stringify(observations), JSON.stringify(answers), report, evidenceKey, evidenceFileName).run();
  return Response.json({ submission: { id: result.meta.last_row_id, practicalId: practical.id, attemptNumber, status: "submitted" } }, { status: 201 });
}

export async function PATCH(request: Request) {
  const account = await requireActiveProfile(["facilitator", "admin"]);
  if (account.error || !account.profile) return account.error;
  const payload = await request.json() as { id?: number; mark?: number; feedback?: string; competencyNote?: string; decision?: "competent" | "developing" | "resubmit" };
  const id = Number(payload.id); const mark = Math.round(Number(payload.mark)); const feedback = String(payload.feedback ?? "").trim(); const competencyNote = String(payload.competencyNote ?? "").trim();
  if (!id || !["competent", "developing", "resubmit"].includes(payload.decision ?? "")) return Response.json({ error: "Choose a valid competency decision." }, { status: 400 });
  if (!Number.isFinite(mark) || mark < 0 || mark > 100) return Response.json({ error: "Enter a mark between 0 and 100." }, { status: 400 });
  if (!feedback || !competencyNote) return Response.json({ error: "Provide feedback and a competency note." }, { status: 400 });
  const existing = await getRawDb().prepare("SELECT id FROM virtual_lab_submissions WHERE id = ? LIMIT 1").bind(id).first<{ id: number }>();
  if (!existing) return Response.json({ error: "The practical submission was not found." }, { status: 404 });
  const passed = payload.decision === "competent" && mark >= 60;
  const status = payload.decision === "resubmit" ? "resubmit" : "assessed";
  await getRawDb().prepare("UPDATE virtual_lab_submissions SET status = ?, mark = ?, passed = ?, feedback = ?, competency_note = ?, assessed_by_email = ?, assessed_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(status, mark, passed ? 1 : 0, feedback, competencyNote, account.profile.email, id).run();
  return Response.json({ updated: true, passed, status });
}
