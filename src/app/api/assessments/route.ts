import { getRawDb } from "@/db/raw";
import { requireActiveProfile } from "@/lib/accounts";

type Question = { id: string; type: string; correctAnswer?: string; points?: number; pairs?: { left: string; right: string; image?: string }[] };

function same(a: unknown, b: unknown) { return String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase(); }

export async function POST(request: Request) {
  const account = await requireActiveProfile(["learner"]);
  if (account.error || !account.profile) return account.error;
  const payload = await request.json() as { courseCode?: string; answers?: Record<string, unknown> };
  const courseCode = payload.courseCode?.trim() ?? "";
  const enrolled = await getRawDb().prepare("SELECT id FROM enrollments WHERE user_email = ? AND course_code = ? AND status = 'active' LIMIT 1").bind(account.profile.email, courseCode).first();
  if (!enrolled) return Response.json({ error: "Enrol in this course before completing its assessment." }, { status: 403 });
  const course = await getRawDb().prepare("SELECT title, assessment_config_json, question_limit, certificate_enabled FROM course_drafts WHERE code = ? AND status = 'active' LIMIT 1").bind(courseCode).first<{ title: string; assessment_config_json: string; question_limit: number; certificate_enabled: number }>();
  if (!course) return Response.json({ error: "The active course assessment was not found." }, { status: 404 });
  const config = JSON.parse(course.assessment_config_json || "{}") as { passMark?: number; questions?: Question[] };
  const questions = (config.questions ?? []).slice(0, course.question_limit || 100);
  if (!questions.length) return Response.json({ error: "This course does not yet have an assessment." }, { status: 409 });
  let earned = 0; let total = 0; const answers = payload.answers ?? {};
  for (const question of questions) {
    const points = Math.max(1, Number(question.points) || 1); total += points;
    const answer = answers[question.id];
    if (["Matching", "Drag and drop", "Picture matching"].includes(question.type)) {
      const expected = Object.fromEntries((question.pairs ?? []).map((pair) => [pair.left, pair.right]));
      const actual = typeof answer === "object" && answer ? answer as Record<string, unknown> : {};
      if (Object.keys(expected).length > 0 && Object.entries(expected).every(([left, right]) => same(actual[left], right))) earned += points;
    } else if (["Essay", "Practical assignment"].includes(question.type)) {
      if (String(answer ?? "").trim()) earned += points;
    } else if (same(answer, question.correctAnswer)) earned += points;
  }
  const score = total ? Math.round((earned / total) * 100) : 0; const passed = score >= Math.min(100, Math.max(1, Number(config.passMark) || 70));
  await getRawDb().prepare("INSERT INTO assessment_attempts (user_email, course_code, score, passed, answers_json, completed_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(user_email, course_code) DO UPDATE SET score = excluded.score, passed = excluded.passed, answers_json = excluded.answers_json, completed_at = CURRENT_TIMESTAMP")
    .bind(account.profile.email, courseCode, score, passed ? 1 : 0, JSON.stringify(answers)).run();
  let certificate = null;
  if (passed && course.certificate_enabled) {
    const code = `UCC${crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
    await getRawDb().prepare("INSERT OR IGNORE INTO certificates (certificate_code, user_email, learner_name, course_code, course_title) VALUES (?, ?, ?, ?, ?)").bind(code, account.profile.email, account.profile.full_name, courseCode, course.title).run();
    certificate = await getRawDb().prepare("SELECT certificate_code, learner_name, course_code, course_title, issued_at FROM certificates WHERE user_email = ? AND course_code = ? LIMIT 1").bind(account.profile.email, courseCode).first();
    await getRawDb().prepare("UPDATE enrollments SET status = 'completed' WHERE user_email = ? AND course_code = ?").bind(account.profile.email, courseCode).run();
  }
  return Response.json({ score, passed, certificate });
}
