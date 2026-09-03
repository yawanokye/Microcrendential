import { getRawDb } from "@/db/raw";
import { requireActiveProfile } from "@/lib/accounts";

type CourseAnalytics = { code: string; title: string; discipline: string; status: string; enrolled: number; active_learners: number; completed: number; average_score: number | null; pass_rate: number | null; pending_evidence: number };

export async function GET() {
  const account = await requireActiveProfile(["facilitator", "admin"]);
  if (account.error || !account.profile) return account.error;
  const db = getRawDb();
  const scope = account.profile.role === "facilitator" ? "WHERE c.created_by_email = ?" : "";
  const sql = `
    SELECT c.code, c.title, c.discipline, c.status,
      COUNT(DISTINCT e.user_email) AS enrolled,
      COUNT(DISTINCT CASE WHEN e.status = 'active' THEN e.user_email END) AS active_learners,
      COUNT(DISTINCT CASE WHEN e.status = 'completed' THEN e.user_email END) AS completed,
      ROUND(AVG(a.score), 1) AS average_score,
      ROUND(100.0 * SUM(CASE WHEN a.passed = 1 THEN 1 ELSE 0 END) / NULLIF(COUNT(a.id), 0), 1) AS pass_rate,
      (
        SELECT COUNT(*) FROM colab_submissions cs
        JOIN colab_assignments ca ON ca.id = cs.assignment_id
        WHERE ca.course_code = c.code AND cs.status = 'submitted'
      ) + (
        SELECT COUNT(*) FROM virtual_lab_submissions vs
        WHERE vs.status = 'submitted' AND instr(c.activities_json, '"practicalId":"' || vs.practical_id || '"') > 0
      ) AS pending_evidence
    FROM course_drafts c
    LEFT JOIN enrollments e ON e.course_code = c.code
    LEFT JOIN assessment_attempts a ON a.course_code = c.code AND a.user_email = e.user_email
    ${scope}
    GROUP BY c.id
    ORDER BY CASE c.status WHEN 'active' THEN 0 WHEN 'pending_review' THEN 1 ELSE 2 END, c.created_at DESC
    LIMIT 100
  `;
  const statement = db.prepare(sql);
  const rows = account.profile.role === "facilitator" ? await statement.bind(account.profile.email).all<CourseAnalytics>() : await statement.all<CourseAnalytics>();
  const courses = rows.results.map((item) => ({
    code: item.code,
    title: item.title,
    discipline: item.discipline,
    status: item.status,
    enrolled: Number(item.enrolled ?? 0),
    activeLearners: Number(item.active_learners ?? 0),
    completed: Number(item.completed ?? 0),
    averageScore: item.average_score === null ? null : Number(item.average_score),
    passRate: item.pass_rate === null ? null : Number(item.pass_rate),
    pendingEvidence: Number(item.pending_evidence ?? 0),
  }));
  return Response.json({
    role: account.profile.role,
    totals: {
      courses: courses.length,
      enrolled: courses.reduce((sum, item) => sum + item.enrolled, 0),
      completed: courses.reduce((sum, item) => sum + item.completed, 0),
      pendingEvidence: courses.reduce((sum, item) => sum + item.pendingEvidence, 0),
    },
    courses,
  });
}
