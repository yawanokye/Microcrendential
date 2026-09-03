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
  if (design.enrolmentMode !== "open") return Response.json({ error: design.enrolmentMode === "application" ? "This course requires an application decision before enrolment." : "This course is available by invitation only." }, { status: 409 });
  if (design.priceGhs > 0) return Response.json({ error: "This paid offering requires an authorised UCC enrolment or payment workflow before access can be granted." }, { status: 409 });
  await getRawDb().prepare("INSERT OR IGNORE INTO enrollments (user_email, course_code, status) VALUES (?, ?, 'active')")
    .bind(account.profile.email, courseCode).run();
  return Response.json({ enrolled: true, courseCode }, { status: 201 });
}
