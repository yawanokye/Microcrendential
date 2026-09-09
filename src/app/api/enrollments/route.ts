import { getRawDb } from "@/db/raw";
import { requireActiveProfile } from "@/lib/accounts";
import { normalizeCourseDesign } from "@/lib/course-design";

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
  if (design.enrolmentMode !== "open") return Response.json({ error: "This course is not currently configured for self-enrolment." }, { status: 409 });
  if (design.priceGhs > 0) {
    const paid = await getRawDb().prepare("SELECT id FROM payment_orders WHERE user_email = ? AND course_code = ? AND purpose = 'enrollment' AND status = 'paid' LIMIT 1")
      .bind(account.profile.email, courseCode).first();
    if (!paid) return Response.json({ error: "Payment is required to enrol in this course.", paymentRequired: true, purpose: "enrollment", amountGhs: design.priceGhs }, { status: 402 });
  }
  await getRawDb().prepare("INSERT OR IGNORE INTO enrollments (user_email, course_code, status) VALUES (?, ?, 'active')")
    .bind(account.profile.email, courseCode).run();
  return Response.json({ enrolled: true, courseCode }, { status: 201 });
}
