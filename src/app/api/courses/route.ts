import { getRawDb } from "@/db/raw";
import { requireActiveProfile } from "@/lib/accounts";

type CourseRow = {
  id: number; code: string; title: string; discipline: string; description: string; materials_json: string; activities_json: string; assessment_modes_json: string;
  assessment_config_json: string; gate_required: number; question_limit: number; certificate_enabled: number; status: string;
  created_by_email: string; facilitator_name: string | null; activated_at: string | null; created_at: string;
};

function present(row: CourseRow) {
  return { id: row.id, code: row.code, title: row.title, discipline: row.discipline, description: row.description, materials: JSON.parse(row.materials_json || "[]"), activities: JSON.parse(row.activities_json || "[]"), assessmentModes: JSON.parse(row.assessment_modes_json || "[]"), assessmentConfig: JSON.parse(row.assessment_config_json || "{}"), gateRequired: Boolean(row.gate_required), questionLimit: row.question_limit, certificateEnabled: Boolean(row.certificate_enabled), status: row.status, createdByEmail: row.created_by_email, facilitatorName: row.facilitator_name ?? row.created_by_email, activatedAt: row.activated_at, createdAt: row.created_at };
}

export async function GET() {
  const account = await requireActiveProfile();
  if (account.error || !account.profile) return account.error;
  const select = "SELECT c.*, u.full_name AS facilitator_name FROM course_drafts c LEFT JOIN users u ON u.email = c.created_by_email";
  const db = getRawDb();
  let rows;
  if (account.profile.role === "learner") rows = await db.prepare(`${select} WHERE c.status = 'active' ORDER BY c.activated_at DESC, c.created_at DESC LIMIT 100`).all<CourseRow>();
  else if (account.profile.role === "facilitator") rows = await db.prepare(`${select} WHERE c.created_by_email = ? OR c.status = 'active' ORDER BY c.created_at DESC LIMIT 100`).bind(account.profile.email).all<CourseRow>();
  else rows = await db.prepare(`${select} ORDER BY CASE c.status WHEN 'pending_review' THEN 0 WHEN 'active' THEN 1 ELSE 2 END, c.created_at DESC LIMIT 100`).all<CourseRow>();
  return Response.json({ courses: rows.results.map(present) });
}

export async function POST(request: Request) {
  const account = await requireActiveProfile(["facilitator", "admin"]);
  if (account.error || !account.profile) return account.error;
  const payload = await request.json() as { code?: string; title?: string; discipline?: string; description?: string; materials?: unknown[]; activities?: unknown[]; assessmentModes?: string[]; assessmentConfig?: unknown; gateRequired?: boolean; questionLimit?: number; certificateEnabled?: boolean };
  const title = payload.title?.trim() ?? ""; const code = payload.code?.trim().toUpperCase() ?? ""; const discipline = payload.discipline?.trim() ?? "";
  if (!title || !code || !discipline) return Response.json({ error: "Course title, code and discipline are required." }, { status: 400 });
  const existing = await getRawDb().prepare("SELECT id FROM course_drafts WHERE code = ? LIMIT 1").bind(code).first();
  if (existing) return Response.json({ error: "That course code is already in use." }, { status: 409 });
  const questionLimit = Math.min(100, Math.max(1, Number(payload.questionLimit) || 10));
  const result = await getRawDb().prepare("INSERT INTO course_drafts (code, title, discipline, description, materials_json, activities_json, assessment_modes_json, assessment_config_json, gate_required, question_limit, certificate_enabled, status, created_by_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_review', ?)")
    .bind(code, title, discipline, payload.description?.trim() ?? "", JSON.stringify(payload.materials ?? []), JSON.stringify(payload.activities ?? []), JSON.stringify(payload.assessmentModes ?? []), JSON.stringify(payload.assessmentConfig ?? {}), payload.gateRequired === false ? 0 : 1, questionLimit, payload.certificateEnabled === false ? 0 : 1, account.profile.email).run();
  return Response.json({ course: { id: result.meta.last_row_id, code, title, discipline, status: "pending_review" } }, { status: 201 });
}

export async function PATCH(request: Request) {
  const account = await requireActiveProfile(["admin"]);
  if (account.error || !account.profile) return account.error;
  const payload = await request.json() as { id?: number; status?: "active" | "pending_review" | "rejected" };
  if (!payload.id || !["active", "pending_review", "rejected"].includes(payload.status ?? "")) return Response.json({ error: "Choose a course and valid review decision." }, { status: 400 });
  const active = payload.status === "active";
  const db = getRawDb();
  const course = await db.prepare("SELECT code, title, activities_json, created_by_email FROM course_drafts WHERE id = ? LIMIT 1").bind(payload.id).first<{ code: string; title: string; activities_json: string; created_by_email: string }>();
  if (!course) return Response.json({ error: "Course was not found." }, { status: 404 });
  const result = await db.prepare("UPDATE course_drafts SET status = ?, activated_by_email = ?, activated_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END WHERE id = ?")
    .bind(payload.status, account.profile.email, active ? 1 : 0, payload.id).run();
  if (!result.meta.changes) return Response.json({ error: "Course was not found." }, { status: 404 });
  if (active) {
    let activities: { id?: string; kind?: string; title?: string; instructions?: string; notebookKey?: string; notebookFileName?: string; templateUrl?: string; rubric?: string; maxMark?: number; passMark?: number; attemptsAllowed?: number; dueAt?: string }[] = [];
    try { activities = JSON.parse(course.activities_json || "[]") as typeof activities; } catch { activities = []; }
    for (const activity of activities.filter((item) => item.kind === "colab" && item.notebookKey && item.notebookFileName)) {
      const exists = await db.prepare("SELECT id FROM colab_assignments WHERE course_code = ? AND title = ? LIMIT 1").bind(course.code, activity.title ?? "Colab coding activity").first<{ id: number }>();
      if (exists) continue;
      await db.prepare("INSERT INTO colab_assignments (course_code, title, instructions, template_file_key, template_file_name, template_url, rubric, max_mark, pass_mark, attempts_allowed, due_at, status, created_by_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)")
        .bind(course.code, activity.title ?? "Colab coding activity", activity.instructions ?? "Complete the notebook in free Google Colab and submit your evidence.", activity.notebookKey, activity.notebookFileName, activity.templateUrl || null, activity.rubric ?? "Assess correctness, interpretation and reproducibility.", Math.min(1000, Math.max(1, Number(activity.maxMark) || 100)), Math.min(100, Math.max(1, Number(activity.passMark) || 60)), Math.min(10, Math.max(1, Number(activity.attemptsAllowed) || 2)), activity.dueAt || null, course.created_by_email).run();
    }
  }
  return Response.json({ updated: true, status: payload.status });
}
