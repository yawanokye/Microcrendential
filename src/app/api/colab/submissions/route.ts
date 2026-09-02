import { getRawDb } from "@/db/raw";
import { requireActiveProfile } from "@/lib/accounts";
import { issueCertificateIfComplete } from "@/lib/course-completion";
import { putStoredFile } from "@/lib/render-storage";

type SubmissionRow = {
  id: number; assignment_id: number; assignment_title: string; course_code: string; course_title: string;
  learner_email: string; learner_name: string; attempt_number: number; submission_type: string;
  notebook_file_name: string | null; notebook_url: string | null; status: string; mark: number | null;
  passed: number; feedback: string; max_mark: number; pass_mark: number; submitted_at: string; assessed_at: string | null;
};

function present(row: SubmissionRow) {
  return {
    id: row.id, assignmentId: row.assignment_id, assignmentTitle: row.assignment_title,
    courseCode: row.course_code, courseTitle: row.course_title, learnerEmail: row.learner_email,
    learnerName: row.learner_name, attemptNumber: row.attempt_number, submissionType: row.submission_type,
    notebookFileName: row.notebook_file_name, notebookUrl: row.notebook_url, status: row.status,
    mark: row.mark, passed: Boolean(row.passed), feedback: row.feedback, maxMark: row.max_mark,
    passMark: row.pass_mark, submittedAt: row.submitted_at, assessedAt: row.assessed_at,
  };
}

export async function GET() {
  const account = await requireActiveProfile();
  if (account.error || !account.profile) return account.error;
  const base = `
    SELECT s.*, a.title AS assignment_title, a.course_code, a.max_mark, a.pass_mark,
      c.title AS course_title, u.full_name AS learner_name
    FROM colab_submissions s
    JOIN colab_assignments a ON a.id = s.assignment_id
    JOIN course_drafts c ON c.code = a.course_code
    LEFT JOIN users u ON u.email = s.learner_email
  `;
  const db = getRawDb();
  let rows;
  if (account.profile.role === "learner") rows = await db.prepare(`${base} WHERE s.learner_email = ? ORDER BY s.submitted_at DESC`).bind(account.profile.email).all<SubmissionRow>();
  else if (account.profile.role === "facilitator") rows = await db.prepare(`${base} WHERE a.created_by_email = ? ORDER BY CASE s.status WHEN 'submitted' THEN 0 ELSE 1 END, s.submitted_at DESC`).bind(account.profile.email).all<SubmissionRow>();
  else rows = await db.prepare(`${base} ORDER BY CASE s.status WHEN 'submitted' THEN 0 ELSE 1 END, s.submitted_at DESC`).all<SubmissionRow>();
  return Response.json({ submissions: rows.results.map(present) });
}

export async function POST(request: Request) {
  const account = await requireActiveProfile(["learner"]);
  if (account.error || !account.profile) return account.error;
  const form = await request.formData();
  const assignmentId = Number(form.get("assignmentId"));
  const sharingLink = String(form.get("sharingLink") ?? "").trim();
  const file = form.get("notebook");
  const hasFile = file instanceof File && file.size > 0;
  if (!assignmentId || (hasFile === Boolean(sharingLink))) return Response.json({ error: "Submit either one completed .ipynb file or one sharing link." }, { status: 400 });
  if (sharingLink) {
    try {
      const url = new URL(sharingLink);
      if (!["colab.research.google.com", "drive.google.com"].includes(url.hostname)) throw new Error();
    } catch { return Response.json({ error: "Use a valid Google Colab or Google Drive sharing link." }, { status: 400 }); }
  }
  if (hasFile) {
    if (!file.name.toLowerCase().endsWith(".ipynb")) return Response.json({ error: "Only completed .ipynb notebook files are accepted." }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return Response.json({ error: "Completed notebooks must be 10 MB or smaller." }, { status: 413 });
    try {
      const notebook = JSON.parse(await file.text()) as { cells?: unknown[]; nbformat?: number };
      if (!Array.isArray(notebook.cells) || !Number.isInteger(notebook.nbformat)) throw new Error();
    } catch { return Response.json({ error: "The uploaded file is not a readable Jupyter notebook." }, { status: 400 }); }
  }
  const db = getRawDb();
  const assignment = await db.prepare(`
    SELECT a.id, a.course_code, a.attempts_allowed, a.due_at
    FROM colab_assignments a JOIN course_drafts c ON c.code = a.course_code AND c.status = 'active'
    JOIN enrollments e ON e.course_code = a.course_code AND e.user_email = ? AND e.status IN ('active', 'completed')
    WHERE a.id = ? AND a.status = 'active' LIMIT 1
  `).bind(account.profile.email, assignmentId).first<{ id: number; course_code: string; attempts_allowed: number; due_at: string | null }>();
  if (!assignment) return Response.json({ error: "This Colab assignment is unavailable or you are not enrolled." }, { status: 403 });
  if (assignment.due_at && Date.now() > Date.parse(assignment.due_at)) return Response.json({ error: "The submission deadline has passed. Contact the facilitator if an extension is required." }, { status: 409 });
  const previous = await db.prepare("SELECT COUNT(*) AS count FROM colab_submissions WHERE assignment_id = ? AND learner_email = ?").bind(assignmentId, account.profile.email).first<{ count: number }>();
  const attemptNumber = Number(previous?.count ?? 0) + 1;
  if (attemptNumber > assignment.attempts_allowed) return Response.json({ error: "You have used all permitted submission attempts." }, { status: 409 });
  let key: string | null = null;
  let fileName: string | null = null;
  if (hasFile) {
    key = await putStoredFile(`colab-submissions/${assignmentId}`, file, { contentType: "application/x-ipynb+json", originalName: file.name, ownerEmail: account.profile.email });
    fileName = file.name;
  }
  const result = await db.prepare(`
    INSERT INTO colab_submissions
      (assignment_id, learner_email, attempt_number, submission_type, notebook_key, notebook_file_name, notebook_url, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'submitted')
  `).bind(assignmentId, account.profile.email, attemptNumber, hasFile ? "file" : "link", key, fileName, sharingLink || null).run();
  return Response.json({ submission: { id: result.meta.last_row_id, assignmentId, attemptNumber, status: "submitted" } }, { status: 201 });
}

export async function PATCH(request: Request) {
  const account = await requireActiveProfile(["facilitator", "admin"]);
  if (account.error || !account.profile) return account.error;
  const payload = await request.json() as { id?: number; mark?: number; feedback?: string; decision?: "assessed" | "resubmit" };
  const id = Number(payload.id);
  const decision = payload.decision;
  if (!id || !["assessed", "resubmit"].includes(decision ?? "")) return Response.json({ error: "Choose a submission and assessment decision." }, { status: 400 });
  const db = getRawDb();
  const sql = account.profile.role === "admin" ? `
    SELECT s.id, s.learner_email, a.course_code, a.max_mark, a.pass_mark
    FROM colab_submissions s JOIN colab_assignments a ON a.id = s.assignment_id WHERE s.id = ? LIMIT 1
  ` : `
    SELECT s.id, s.learner_email, a.course_code, a.max_mark, a.pass_mark
    FROM colab_submissions s JOIN colab_assignments a ON a.id = s.assignment_id
    WHERE s.id = ? AND a.created_by_email = ? LIMIT 1
  `;
  const statement = db.prepare(sql);
  const record = account.profile.role === "admin" ? await statement.bind(id).first<{ learner_email: string; course_code: string; max_mark: number; pass_mark: number }>() : await statement.bind(id, account.profile.email).first<{ learner_email: string; course_code: string; max_mark: number; pass_mark: number }>();
  if (!record) return Response.json({ error: "Submission was not found or is not assigned to you." }, { status: 404 });
  const mark = Math.round(Number(payload.mark));
  if (!Number.isFinite(mark) || mark < 0 || mark > record.max_mark) return Response.json({ error: `Enter a mark between 0 and ${record.max_mark}.` }, { status: 400 });
  const feedback = String(payload.feedback ?? "").trim();
  if (!feedback) return Response.json({ error: "Provide assessment feedback before saving the decision." }, { status: 400 });
  const passed = decision === "assessed" && (mark / record.max_mark) * 100 >= record.pass_mark;
  await db.prepare("UPDATE colab_submissions SET status = ?, mark = ?, passed = ?, feedback = ?, assessed_by_email = ?, assessed_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(decision, mark, passed ? 1 : 0, feedback, account.profile.email, id).run();
  const completion = passed ? await issueCertificateIfComplete(record.learner_email, record.course_code) : null;
  return Response.json({ updated: true, passed, courseCompleted: completion?.evaluation?.complete ?? false, completion: completion?.evaluation ?? null, certificate: completion?.certificate ?? null });
}
