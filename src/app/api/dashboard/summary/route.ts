import { getRawDb } from "@/db/raw";
import { requireActiveProfile } from "@/lib/accounts";

type CountRow = { total: number };
const count = (row: CountRow | null) => Number(row?.total ?? 0);

export async function GET() {
  const account = await requireActiveProfile();
  if (account.error || !account.profile) return account.error;

  const db = getRawDb();
  const { email, role } = account.profile;

  if (role === "learner") {
    const enrolments = await db.prepare(`
      SELECT
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed
      FROM enrollments WHERE user_email = ?
    `).bind(email).first<{ active: number | null; completed: number | null }>();
    const certificates = await db.prepare("SELECT COUNT(*) AS total FROM certificates WHERE user_email = ?").bind(email).first<CountRow>();
    const colabPending = await db.prepare("SELECT COUNT(*) AS total FROM colab_submissions WHERE learner_email = ? AND status = 'submitted'").bind(email).first<CountRow>();
    const labPending = await db.prepare("SELECT COUNT(*) AS total FROM virtual_lab_submissions WHERE learner_email = ? AND status = 'submitted'").bind(email).first<CountRow>();
    return Response.json({
      role,
      metrics: {
        activeEnrolments: Number(enrolments?.active ?? 0),
        completedCourses: Number(enrolments?.completed ?? 0),
        certificates: count(certificates),
        pendingFeedback: count(colabPending) + count(labPending),
      },
    });
  }

  if (role === "facilitator") {
    const courses = await db.prepare(`
      SELECT
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN status = 'pending_review' THEN 1 ELSE 0 END) AS pending
      FROM course_drafts WHERE created_by_email = ?
    `).bind(email).first<{ active: number | null; pending: number | null }>();
    const colabPending = await db.prepare(`
      SELECT COUNT(*) AS total FROM colab_submissions s
      JOIN colab_assignments a ON a.id = s.assignment_id
      WHERE a.created_by_email = ? AND s.status = 'submitted'
    `).bind(email).first<CountRow>();
    const labPending = await db.prepare(`
      SELECT COUNT(*) AS total FROM virtual_lab_submissions s
      WHERE s.status = 'submitted' AND EXISTS (
        SELECT 1 FROM course_drafts c
        WHERE c.created_by_email = ? AND c.status = 'active'
          AND instr(c.activities_json, '"practicalId":"' || s.practical_id || '"') > 0
      )
    `).bind(email).first<CountRow>();
    const identityReviews = await db.prepare("SELECT COUNT(*) AS total FROM users WHERE identity_status = 'pending_review' AND verifier_email = ?").bind(email).first<CountRow>();
    return Response.json({
      role,
      metrics: {
        activeCourses: Number(courses?.active ?? 0),
        coursesInReview: Number(courses?.pending ?? 0),
        markingQueue: count(colabPending) + count(labPending),
        identityReviews: count(identityReviews),
      },
    });
  }

  const roleCounts = await db.prepare("SELECT role, COUNT(*) AS total FROM users GROUP BY role").all<{ role: string; total: number }>();
  const counts = Object.fromEntries(roleCounts.results.map((row) => [row.role, Number(row.total)]));
  const identityReviews = await db.prepare("SELECT COUNT(*) AS total FROM users WHERE identity_status = 'pending_review'").first<CountRow>();
  const courseApprovals = await db.prepare("SELECT COUNT(*) AS total FROM course_drafts WHERE status = 'pending_review'").first<CountRow>();
  return Response.json({
    role,
    metrics: {
      learners: counts.learner ?? 0,
      facilitators: counts.facilitator ?? 0,
      identityReviews: count(identityReviews),
      courseApprovals: count(courseApprovals),
    },
  });
}
