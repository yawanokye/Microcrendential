import { getRawDb } from "@/db/raw";
import { requireActiveProfile } from "@/lib/accounts";
import { recordAudit } from "@/lib/audit";
import { normalizeCourseDesign } from "@/lib/course-design";
import { rejectCrossSiteMutation } from "@/lib/request-security";

export async function POST(request: Request) {
  const originError = rejectCrossSiteMutation(request); if (originError) return originError;
  const account = await requireActiveProfile(["facilitator", "admin"]); if (account.error || !account.profile) return account.error;
  const payload = await request.json() as { courseId?: number };
  const courseId = Number(payload.courseId);
  if (!Number.isInteger(courseId) || courseId < 1) return Response.json({ error: "Choose an active course to unpublish." }, { status: 400 });
  const db = getRawDb();
  const course = await db.prepare("SELECT id,code,title,created_by_email,status,version_number FROM course_drafts WHERE id=? LIMIT 1").bind(courseId).first<{ id:number; code:string; title:string; created_by_email:string; status:string; version_number:number }>();
  if (!course) return Response.json({ error: "Course was not found." }, { status: 404 });
  if (course.status !== "active") return Response.json({ error: "Only an active published course can be unpublished for revision." }, { status: 409 });
  if (account.profile.role !== "admin" && course.created_by_email !== account.profile.email) return Response.json({ error: "You may unpublish only your own active course." }, { status: 403 });

  const activeBroader = await db.prepare("SELECT code,title,design_json FROM course_drafts WHERE status='active' AND id<>?").bind(courseId).all<{code:string;title:string;design_json:string}>();
  const parent = activeBroader.results.find((row) => {
    try {
      const design = normalizeCourseDesign(JSON.parse(row.design_json || "{}"));
      return design.credentialStructure === "broader" && design.componentCredentialCodes.includes(course.code.toUpperCase());
    } catch { return false; }
  });
  if (parent) return Response.json({ error: `${course.title} is an active component of ${parent.title}. Unpublish or revise the broader credential first so its approved pathway never points to an unpublished component.` }, { status: 409 });

  await db.prepare(`UPDATE course_drafts SET status='draft',certificate_preapproved=0,approval_authority=NULL,approval_meeting_date=NULL,approval_reference=NULL,approval_decision=NULL,approval_conditions=NULL,approval_conditions_satisfied=0,approval_effective_date=NULL,approval_review_date=NULL,approval_document_reference=NULL,approval_recorded_by_email=NULL,approval_recorded_at=NULL,activated_by_email=NULL,activated_at=NULL,submitted_at=NULL,review_comment='Unpublished for facilitator revision.',reviewed_by_email=NULL,reviewed_at=NULL,version_number=version_number+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='active'`).bind(courseId).run();
  await recordAudit(account.profile.email, "course.unpublished_for_revision", { courseId, courseCode: course.code });
  return Response.json({ unpublished: true, course: { id: course.id, code: course.code, title: course.title, status: "draft", versionNumber: course.version_number + 1 } });
}
