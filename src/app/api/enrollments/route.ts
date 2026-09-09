import { getRawDb } from "@/db/raw";
import { requireActiveProfile } from "@/lib/accounts";
import { normalizeCourseDesign } from "@/lib/course-design";

export async function GET() {
  const account = await requireActiveProfile(["learner"]);
  if (account.error || !account.profile) return account.error;
  const rows = await getRawDb().prepare(`SELECT e.course_code, e.status, e.payment_status, e.payment_reference, e.amount_paid_pesewas, e.enrolled_at,
      c.title, c.design_json, c.certificate_enabled, c.certificate_fee_ghs,
      EXISTS(SELECT 1 FROM payment_orders p WHERE p.user_email = e.user_email AND p.course_code = e.course_code AND p.purpose = 'certificate' AND p.status = 'paid') AS certificate_paid
    FROM enrollments e JOIN course_drafts c ON c.code = e.course_code
    WHERE e.user_email = ? AND e.status IN ('active','completed') ORDER BY e.enrolled_at DESC`)
    .bind(account.profile.email).all<{ course_code: string; status: string; payment_status: string; payment_reference: string | null; amount_paid_pesewas: number; enrolled_at: string; title: string; design_json: string; certificate_enabled: number; certificate_fee_ghs: number; certificate_paid: number }>();
  return Response.json({ enrollments: rows.results.map((row) => {
    let rawDesign: unknown = {};
    try { rawDesign = JSON.parse(row.design_json || "{}"); } catch { rawDesign = {}; }
    const design = normalizeCourseDesign(rawDesign);
    return { courseCode: row.course_code, courseTitle: row.title, status: row.status, paymentStatus: row.payment_status, amountPaidGhs: row.amount_paid_pesewas / 100, enrolledAt: row.enrolled_at, enrolmentFeeGhs: design.priceGhs, certificateEnabled: Boolean(row.certificate_enabled), certificateFeeGhs: row.certificate_fee_ghs || 0, certificatePaid: Boolean(row.certificate_paid) };
  }) });
}

export async function POST(request: Request) {
  const account = await requireActiveProfile(["learner"]);
  if (account.error || !account.profile) return account.error;
  const payload = await request.json() as { courseCode?: string };
  const courseCode = payload.courseCode?.trim() ?? "";
  const published = await getRawDb().prepare("SELECT id, design_json FROM course_drafts WHERE code = ? AND status = 'active' LIMIT 1").bind(courseCode).first<{ id: number; design_json: string }>();
  if (!published) return Response.json({ error: "This course is not currently open for self-enrolment." }, { status: 400 });
  let rawDesign: unknown = {};
  try { rawDesign = JSON.parse(published.design_json || "{}"); } catch { rawDesign = {}; }
  const design = normalizeCourseDesign(rawDesign);
  if (design.enrolmentMode !== "open") return Response.json({ error: design.enrolmentMode === "application" ? "This course requires an application decision before enrolment." : "This course is available by invitation only." }, { status: 409 });
  if (design.priceGhs > 0) return Response.json({ error: "Use the secure payment option to enrol in this paid course." }, { status: 409 });
  await getRawDb().prepare("INSERT INTO enrollments (user_email, course_code, status, payment_status) VALUES (?, ?, 'active', 'not_required') ON CONFLICT(user_email, course_code) DO UPDATE SET status = 'active', payment_status = 'not_required'")
    .bind(account.profile.email, courseCode).run();
  return Response.json({ enrolled: true, courseCode }, { status: 201 });
}
