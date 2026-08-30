import { getRawDb } from "@/db/raw";
import { requireActiveProfile } from "@/lib/accounts";
import { putStoredFile } from "@/lib/render-storage";

type AssignmentRow = {
  id: number; course_code: string; course_title: string; title: string; instructions: string;
  template_file_name: string; template_url: string | null; rubric: string; max_mark: number;
  pass_mark: number; attempts_allowed: number; due_at: string | null; status: string;
  created_by_email: string; created_at: string; latest_submission_id?: number | null;
  latest_submission_status?: string | null; latest_mark?: number | null; latest_passed?: number | null;
  latest_attempt?: number | null; latest_feedback?: string | null;
};

function openInColabUrl(value: string | null) {
  if (!value) return "https://colab.research.google.com/";
  try {
    const url = new URL(value);
    if (url.hostname === "colab.research.google.com") return url.toString();
    if (url.hostname === "github.com" && url.pathname.toLowerCase().endsWith(".ipynb")) return `https://colab.research.google.com/github${url.pathname}${url.search}`;
  } catch { /* invalid values are rejected before storage */ }
  return "https://colab.research.google.com/";
}

function present(row: AssignmentRow) {
  return { id: row.id, courseCode: row.course_code, courseTitle: row.course_title, title: row.title, instructions: row.instructions, templateFileName: row.template_file_name, templateUrl: row.template_url, openUrl: openInColabUrl(row.template_url), directOpen: Boolean(row.template_url), rubric: row.rubric, maxMark: row.max_mark, passMark: row.pass_mark, attemptsAllowed: row.attempts_allowed, dueAt: row.due_at, status: row.status, createdByEmail: row.created_by_email, createdAt: row.created_at, latestSubmission: row.latest_submission_id ? { id: row.latest_submission_id, status: row.latest_submission_status, mark: row.latest_mark, passed: Boolean(row.latest_passed), attemptNumber: row.latest_attempt, feedback: row.latest_feedback ?? "" } : null };
}

export async function GET() {
  const account = await requireActiveProfile();
  if (account.error || !account.profile) return account.error;
  const db = getRawDb(); let rows;
  if (account.profile.role === "learner") rows = await db.prepare(`
    SELECT a.*, c.title AS course_title, s.id AS latest_submission_id, s.status AS latest_submission_status,
      s.mark AS latest_mark, s.passed AS latest_passed, s.attempt_number AS latest_attempt, s.feedback AS latest_feedback
    FROM colab_assignments a JOIN course_drafts c ON c.code = a.course_code AND c.status = 'active'
    JOIN enrollments e ON e.course_code = a.course_code AND e.user_email = ? AND e.status IN ('active','completed')
    LEFT JOIN colab_submissions s ON s.id = (SELECT cs.id FROM colab_submissions cs WHERE cs.assignment_id = a.id AND cs.learner_email = ? ORDER BY cs.attempt_number DESC, cs.id DESC LIMIT 1)
    WHERE a.status = 'active' ORDER BY CASE WHEN a.due_at IS NULL THEN 1 ELSE 0 END, a.due_at, a.created_at DESC
  `).bind(account.profile.email, account.profile.email).all<AssignmentRow>();
  else if (account.profile.role === "facilitator") rows = await db.prepare("SELECT a.*, c.title AS course_title FROM colab_assignments a JOIN course_drafts c ON c.code = a.course_code WHERE a.created_by_email = ? ORDER BY a.created_at DESC").bind(account.profile.email).all<AssignmentRow>();
  else rows = await db.prepare("SELECT a.*, c.title AS course_title FROM colab_assignments a JOIN course_drafts c ON c.code = a.course_code ORDER BY a.created_at DESC").all<AssignmentRow>();
  return Response.json({ assignments: rows.results.map(present) });
}

export async function POST(request: Request) {
  const account = await requireActiveProfile(["facilitator", "admin"]);
  if (account.error || !account.profile) return account.error;
  const form = await request.formData();
  const courseCode = String(form.get("courseCode") ?? "").trim().toUpperCase(); const title = String(form.get("title") ?? "").trim();
  const instructions = String(form.get("instructions") ?? "").trim(); const rubric = String(form.get("rubric") ?? "").trim();
  const dueAt = String(form.get("dueAt") ?? "").trim(); const templateUrl = String(form.get("templateUrl") ?? "").trim();
  const maxMark = Math.min(1000, Math.max(1, Number(form.get("maxMark")) || 100)); const passMark = Math.min(100, Math.max(1, Number(form.get("passMark")) || 50));
  const attemptsAllowed = Math.min(10, Math.max(1, Number(form.get("attemptsAllowed")) || 1)); const file = form.get("notebook");
  if (!courseCode || !title || !instructions || !rubric) return Response.json({ error: "Course, title, instructions and rubric are required." }, { status: 400 });
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".ipynb")) return Response.json({ error: "Upload a valid .ipynb notebook template." }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return Response.json({ error: "Notebook templates must be 10 MB or smaller." }, { status: 413 });
  try { const notebook = JSON.parse(await file.text()) as { cells?: unknown[]; nbformat?: number }; if (!Array.isArray(notebook.cells) || !Number.isInteger(notebook.nbformat)) throw new Error(); }
  catch { return Response.json({ error: "The uploaded file is not a readable Jupyter notebook." }, { status: 400 }); }
  if (templateUrl) {
    try { const url = new URL(templateUrl); if (url.hostname === "github.com" && !url.pathname.toLowerCase().endsWith(".ipynb")) throw new Error(); if (!["github.com", "colab.research.google.com"].includes(url.hostname)) throw new Error(); }
    catch { return Response.json({ error: "The direct-open link must be a GitHub .ipynb or Google Colab URL." }, { status: 400 }); }
  }
  if (dueAt && Number.isNaN(Date.parse(dueAt))) return Response.json({ error: "Enter a valid due date and time." }, { status: 400 });
  const db = getRawDb();
  const course = await db.prepare("SELECT code, created_by_email FROM course_drafts WHERE code = ? AND status = 'active' LIMIT 1").bind(courseCode).first<{ code: string; created_by_email: string }>();
  if (!course) return Response.json({ error: "Choose an active course before publishing a Colab assignment." }, { status: 404 });
  if (account.profile.role === "facilitator" && course.created_by_email !== account.profile.email) return Response.json({ error: "You can create assignments only for courses you facilitate." }, { status: 403 });
  const key = await putStoredFile("colab-templates", file, { contentType: "application/x-ipynb+json", originalName: file.name, ownerEmail: account.profile.email });
  const result = await db.prepare("INSERT INTO colab_assignments (course_code, title, instructions, template_file_key, template_file_name, template_url, rubric, max_mark, pass_mark, attempts_allowed, due_at, status, created_by_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)")
    .bind(courseCode, title, instructions, key, file.name, templateUrl || null, rubric, maxMark, passMark, attemptsAllowed, dueAt || null, account.profile.email).run();
  return Response.json({ assignment: { id: result.meta.last_row_id, courseCode, title, status: "active" } }, { status: 201 });
}
