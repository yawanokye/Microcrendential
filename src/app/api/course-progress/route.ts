import { getRawDb } from "@/db/raw";
import { requireActiveProfile } from "@/lib/accounts";

type CourseProgressRow = {
  code: string;
  materials_json: string;
};

type CompletedRow = {
  course_code: string;
  material_id: string;
};

const parseMaterials = (value: string) => {
  try {
    const parsed = JSON.parse(value || "[]") as { id?: string }[];
    return Array.isArray(parsed) ? parsed.map((item, index) => String(item?.id || `material-${index + 1}`)) : [];
  } catch {
    return [];
  }
};

function summarize(course: CourseProgressRow, completedRows: CompletedRow[]) {
  const materialIds = parseMaterials(course.materials_json);
  const valid = new Set(materialIds);
  const completedMaterialIds = [...new Set(completedRows
    .filter((row) => row.course_code === course.code && valid.has(row.material_id))
    .map((row) => row.material_id))];
  const materialTotal = materialIds.length;
  const materialCompleted = completedMaterialIds.length;
  const progress = materialTotal ? Math.round((materialCompleted / materialTotal) * 100) : 0;
  return { courseCode: course.code, completedMaterialIds, materialTotal, materialCompleted, progress };
}

export async function GET(request: Request) {
  const account = await requireActiveProfile(["learner"]);
  if (account.error || !account.profile) return account.error;
  const courseCode = new URL(request.url).searchParams.get("courseCode")?.trim().toUpperCase() ?? "";
  const db = getRawDb();
  const courseRows = await db.prepare(`SELECT c.code, c.materials_json
    FROM course_drafts c
    INNER JOIN enrollments e ON e.course_code = c.code AND e.user_email = ? AND e.status IN ('active','completed')
    WHERE c.status = 'active' AND (? = '' OR c.code = ?)
    ORDER BY c.activated_at DESC, c.created_at DESC`)
    .bind(account.profile.email, courseCode, courseCode).all<CourseProgressRow>();
  if (courseCode && courseRows.results.length === 0) return Response.json({ error: "An active enrolment is required to record learning progress." }, { status: 403 });
  const completed = await db.prepare(`SELECT course_code, material_id FROM course_content_progress
    WHERE user_email = ? AND (? = '' OR course_code = ?)`)
    .bind(account.profile.email, courseCode, courseCode).all<CompletedRow>();
  const summaries = courseRows.results.map((course) => summarize(course, completed.results));
  return Response.json({ summaries, progressByCourse: Object.fromEntries(summaries.map((item) => [item.courseCode, item.progress])), ...(courseCode ? { progress: summaries[0] } : {}) });
}

export async function POST(request: Request) {
  const account = await requireActiveProfile(["learner"]);
  if (account.error || !account.profile) return account.error;
  const payload = await request.json() as { courseCode?: string; materialId?: string; completed?: boolean };
  const courseCode = String(payload.courseCode ?? "").trim().toUpperCase().slice(0, 80);
  const materialId = String(payload.materialId ?? "").trim().slice(0, 80);
  if (!courseCode || !materialId) return Response.json({ error: "Choose a course section before updating progress." }, { status: 400 });
  const db = getRawDb();
  const course = await db.prepare(`SELECT c.code, c.materials_json
    FROM course_drafts c
    INNER JOIN enrollments e ON e.course_code = c.code AND e.user_email = ? AND e.status IN ('active','completed')
    WHERE c.code = ? AND c.status = 'active' LIMIT 1`)
    .bind(account.profile.email, courseCode).first<CourseProgressRow>();
  if (!course) return Response.json({ error: "An active enrolment is required to record learning progress." }, { status: 403 });
  if (!parseMaterials(course.materials_json).includes(materialId)) return Response.json({ error: "That learning section is not part of the active course." }, { status: 404 });
  if (payload.completed === false) {
    await db.prepare("DELETE FROM course_content_progress WHERE user_email = ? AND course_code = ? AND material_id = ?")
      .bind(account.profile.email, courseCode, materialId).run();
  } else {
    await db.prepare(`INSERT INTO course_content_progress (user_email, course_code, material_id, completed_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_email, course_code, material_id) DO UPDATE SET completed_at = CURRENT_TIMESTAMP`)
      .bind(account.profile.email, courseCode, materialId).run();
  }
  const completed = await db.prepare("SELECT course_code, material_id FROM course_content_progress WHERE user_email = ? AND course_code = ?")
    .bind(account.profile.email, courseCode).all<CompletedRow>();
  return Response.json({ progress: summarize(course, completed.results) });
}
