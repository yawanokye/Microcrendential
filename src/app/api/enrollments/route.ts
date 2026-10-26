import { audienceAllowed } from "@/lib/catalogue-access";
import { feeState } from "@/lib/learning-billing";
import { getRawDb } from "@/db/raw";
import { requireActiveProfile } from "@/lib/accounts";
import { normalizeCourseDesign } from "@/lib/course-design";
import { rejectCrossSiteMutation } from "@/lib/request-security";
import { recordAudit } from "@/lib/audit";
import { paymentsEnabled } from "@/lib/runtime-config";
import { enrolWithSnapshot } from "@/lib/course-access";

export async function POST(request: Request) {
  const originError = rejectCrossSiteMutation(request); if (originError) return originError;
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
  if (!audienceAllowed("course",courseCode,account.profile)) return Response.json({error:"Course not found."},{status:404});
  const finance = feeState("course",courseCode,"enrollment",account.profile.email);
  if (!finance.satisfied) {
    if (finance.requiresOrganisation) return Response.json({error:"Your organisation must confirm funding before enrolment. Contact the training coordinator.", organisationPaymentRequired:true},{status:402});
    if (!paymentsEnabled()) return Response.json({error:"Online payment is currently unavailable. Contact learner support."},{status:503});
    return Response.json({error:"Payment is required for this course.",paymentRequired:true,purpose:"enrollment",amountGhs:finance.amountGhs},{status:402});
  }
  const enrolled = enrolWithSnapshot(account.profile.email,courseCode);
  if (enrolled.error) return Response.json({error:enrolled.error},{status:409});
  await recordAudit(account.profile.email, "course.enrolled", { courseCode });
  return Response.json({ enrolled: true, courseCode }, { status: 201 });
}
