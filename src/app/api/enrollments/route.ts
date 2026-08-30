import { getRawDb } from "@/db/raw";
import { requireActiveProfile } from "@/lib/accounts";

const OPEN_COURSES = new Set(["UCC-MC 204", "UCC-MC 118", "UCC-MC 310", "DEMO 101", "DEMO 202", "DEMO 303"]);

export async function POST(request: Request) {
  const account = await requireActiveProfile(["learner"]);
  if (account.error || !account.profile) return account.error;
  const payload = await request.json() as { courseCode?: string };
  const courseCode = payload.courseCode?.trim() ?? "";
  const published = await getRawDb().prepare("SELECT id FROM course_drafts WHERE code = ? AND status = 'active' LIMIT 1").bind(courseCode).first();
  if (!OPEN_COURSES.has(courseCode) && !published) return Response.json({ error: "This course is not currently open for self-enrolment." }, { status: 400 });
  await getRawDb().prepare("INSERT OR IGNORE INTO enrollments (user_email, course_code, status) VALUES (?, ?, 'active')")
    .bind(account.profile.email, courseCode).run();
  return Response.json({ enrolled: true, courseCode }, { status: 201 });
}
