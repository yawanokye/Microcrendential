import { getRawDb } from "@/db/raw";
import { normalizeCourseDesign } from "@/lib/course-design";
import { issueBroaderCredentialsIfEligible } from "@/lib/credential-stack";
import { ensureStructuredLearningActivities } from "@/lib/structured-learning-activities";
import type { CourseMaterialRecord } from "@/lib/course-design";
import { certificateIssuerName, isCpdAward, requiresUccSignatory, type CertificateConfiguration } from "@/lib/certificate-policy";

type CourseActivity = {
  id?: string;
  kind?: "colab" | "virtual_lab" | "inline";
  title?: string;
  required?: boolean;
  practicalId?: string;
  materialId?: string;
  maxMark?: number;
  passMark?: number;
};

export type CompletionRequirement = {
  id: string;
  type: "identity" | "assessment" | "content" | "learning_activity" | "virtual_lab" | "colab";
  label: string;
  complete: boolean;
  evidence?: string;
};

export type CompletionEvaluation = {
  courseCode: string;
  courseTitle: string;
  certificateEnabled: boolean;
  certificateFeeGhs: number;
  certificatePaymentRequired: boolean;
  certificatePreauthorised: boolean;
  certificateAuthorizationReference: string | null;
  certificateAuthorizationAuthority: string | null;
  creditValue: number;
  learningMode: string;
  certificateConfiguration: CertificateConfiguration;
  complete: boolean;
  requirements: CompletionRequirement[];
};

export type IssuedCertificate = {
  certificate_code: string;
  learner_name: string;
  course_code: string;
  course_title: string;
  issuer_name: string;
  requirements_json: string;
  credential_type: string;
  status: string;
  issued_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  revocation_reason: string | null;
  credit_value: number;
  learning_mode: string;
  award_type: string; issuance_model: string; partner_name:string|null; partner_logo_key:string|null;
  partner_signatory_name:string|null; partner_signatory_title:string|null; partner_signature_key:string|null;
  cpd_hours:number; cpd_points:number; professional_approval_body:string|null; professional_approval_reference:string|null; show_academic_lead:number;
  facilitator_name:string|null; facilitator_title:string|null; facilitator_signature_key:string|null;
  provost_name:string|null; provost_title:string|null; provost_signature_key:string|null;
};

const parseJson = <T,>(value: string, fallback: T) => { try { return JSON.parse(value || "") as T; } catch { return fallback; } };
const parseActivities = (materialsJson: string, activitiesJson: string) => ensureStructuredLearningActivities(
  parseJson<CourseMaterialRecord[]>(materialsJson, []),
  parseJson<unknown[]>(activitiesJson, []),
) as CourseActivity[];

export async function evaluateCourseCompletion(userEmail: string, courseCode: string): Promise<CompletionEvaluation | null> {
  const db = getRawDb();
  const course = await db.prepare("SELECT code, title, materials_json, activities_json, design_json, certificate_enabled, certificate_preapproved, approval_reference, approval_authority, created_by_email FROM course_drafts WHERE code = ? AND status = 'active' LIMIT 1")
    .bind(courseCode).first<{ code: string; title: string; materials_json:string; activities_json: string; design_json: string; certificate_enabled: number; certificate_preapproved:number; approval_reference:string|null; approval_authority:string|null; created_by_email:string }>();
  if (!course) return null;

  const user = await db.prepare("SELECT full_name, status, identity_status FROM users WHERE email = ? AND role = 'learner' LIMIT 1")
    .bind(userEmail).first<{ full_name: string; status: string; identity_status: string }>();
  const assessment = await db.prepare("SELECT score, passed, completed_at FROM assessment_attempts WHERE user_email = ? AND course_code = ? LIMIT 1")
    .bind(userEmail, course.code).first<{ score: number; passed: number; completed_at: string }>();

  const requirements: CompletionRequirement[] = [
    {
      id: "verified-identity",
      type: "identity",
      label: "Verified learner identity",
      complete: user?.status === "active" && user.identity_status === "verified",
      evidence: user?.identity_status ?? "not_submitted",
    },
    {
      id: "course-assessment",
      type: "assessment",
      label: "Course assessment passed",
      complete: Boolean(assessment?.passed),
      evidence: assessment ? `${assessment.score}% · ${assessment.completed_at}` : "No passing attempt recorded",
    },
  ];

  let materials:{id?:string;title?:string;required?:boolean}[]=[];try{materials=JSON.parse(course.materials_json||"[]");}catch{}
  for(const [index,material] of materials.map((item,index)=>({...item,resolvedId:String(item.id??`material-${index+1}`)})).filter(item=>item.required!==false).entries()){
    const progress=await db.prepare("SELECT completed,completed_at FROM learning_progress WHERE user_email=? AND course_code=? AND material_id=?").bind(userEmail,course.code,material.resolvedId).first<{completed:number;completed_at:string|null}>();
    requirements.push({id:`content-${material.resolvedId}`,type:"content",label:material.title?.trim()||`Required lesson ${index+1}`,complete:Boolean(progress?.completed),evidence:progress?.completed?`Completed ${progress.completed_at??"during this enrolment"}`:"Open the lesson and select Continue"});
  }

  for (const [index, activity] of parseActivities(course.materials_json, course.activities_json).filter((item) => item.required !== false).entries()) {
    if (activity.kind === "virtual_lab") {
      const practicalId = String(activity.practicalId ?? "").trim();
      const submission = practicalId ? await db.prepare("SELECT id, status, mark, feedback, assessed_at FROM virtual_lab_submissions WHERE learner_email = ? AND practical_id = ? ORDER BY id DESC LIMIT 1")
        .bind(userEmail, practicalId).first<{ id: number; status:string; mark: number | null; feedback:string; assessed_at: string | null }>() : null;
      const maximum=Math.max(1,Number(activity.maxMark)||100),threshold=Math.min(100,Math.max(1,Number(activity.passMark)||60));
      const percentage=submission?.mark===null||submission?.mark===undefined?null:(Number(submission.mark)/maximum)*100;
      const activityPassed=Boolean(submission&&submission.status==="assessed"&&percentage!==null&&percentage>=threshold&&submission.feedback?.trim());
      requirements.push({
        id: String(activity.id || `virtual-lab-${index + 1}`),
        type: "virtual_lab",
        label: activity.title?.trim() || "Required virtual practical",
        complete: activityPassed,
        evidence: submission ? `Submission ${submission.id} · ${submission.mark ?? 0}/${maximum} · pass mark ${threshold}% · ${submission.assessed_at ?? submission.status}` : "Passing practical evidence required",
      });
    }
    if (activity.kind === "colab") {
      const title = String(activity.title ?? "").trim();
      const assignment = title ? await db.prepare("SELECT id FROM colab_assignments WHERE course_code = ? AND title = ? AND status = 'active' ORDER BY id DESC LIMIT 1")
        .bind(course.code, title).first<{ id: number }>() : null;
      const submission = assignment ? await db.prepare("SELECT id, mark, feedback, assessed_at FROM colab_submissions WHERE assignment_id = ? AND learner_email = ? AND passed = 1 AND length(trim(feedback)) > 0 ORDER BY assessed_at DESC, id DESC LIMIT 1")
        .bind(assignment.id, userEmail).first<{ id: number; mark: number | null; feedback:string; assessed_at: string | null }>() : null;
      requirements.push({
        id: String(activity.id || `colab-${index + 1}`),
        type: "colab",
        label: activity.title?.trim() || "Required Colab activity",
        complete: Boolean(submission),
        evidence: submission ? `Submission ${submission.id} · ${submission.mark ?? 0} marks · ${submission.assessed_at ?? "assessed"}` : "Passing notebook evidence required",
      });
    }
    if (activity.kind === "inline") {
      const activityId = String(activity.id || `inline-${index + 1}`);
      const submission = await db.prepare("SELECT id,mark,max_mark,pass_mark,feedback,assessed_at FROM material_activity_submissions WHERE user_email=? AND course_code=? AND activity_id=? AND passed=1 AND length(trim(feedback))>0 ORDER BY assessed_at DESC,id DESC LIMIT 1")
        .bind(userEmail, course.code, activityId).first<{id:number;mark:number|null;max_mark:number;pass_mark:number;feedback:string;assessed_at:string|null}>();
      requirements.push({
        id: activityId,
        type: "learning_activity",
        label: activity.title?.trim() || "Required section learning activity",
        complete: Boolean(submission),
        evidence: submission ? `Submission ${submission.id} · ${submission.mark ?? 0}/${submission.max_mark} · pass mark ${submission.pass_mark}% · feedback recorded` : "Pass this learning activity and receive feedback before the section can be completed",
      });
    }
  }

  let rawDesign: unknown = {};
  try { rawDesign = JSON.parse(course.design_json || "{}"); } catch { rawDesign = {}; }
  const design = normalizeCourseDesign(rawDesign);
  const paidCertificate = design.certificateFeeGhs > 0 ? await db.prepare("SELECT id FROM payment_orders WHERE user_email = ? AND course_code = ? AND purpose = 'certificate' AND status = 'paid' LIMIT 1")
    .bind(userEmail, course.code).first() : null;
  return {
    courseCode: course.code,
    courseTitle: course.title,
    certificateEnabled: Boolean(course.certificate_enabled),
    certificateFeeGhs: design.certificateFeeGhs,
    certificatePaymentRequired: design.certificateFeeGhs > 0 && !paidCertificate,
    certificatePreauthorised: Boolean(course.certificate_preapproved),
    certificateAuthorizationReference: course.approval_reference,
    certificateAuthorizationAuthority: course.approval_authority,
    creditValue: design.creditValue,
    learningMode: design.deliveryPattern,
    certificateConfiguration: {
      ...design.certificate,
      cpdHours: isCpdAward(design.certificate.awardType) && design.certificate.cpdHours <= 0 ? design.expectedHours : design.certificate.cpdHours,
    },
    complete: requirements.every((requirement) => requirement.complete),
    requirements,
  };
}

export async function issueCertificateIfComplete(userEmail: string, courseCode: string) {
  const evaluation = await evaluateCourseCompletion(userEmail, courseCode);
  if (!evaluation) return { evaluation: null, certificate: null };
  if (!evaluation.complete) return { evaluation, certificate: null };

  const db = getRawDb();
  await db.prepare("UPDATE enrollments SET status = 'completed' WHERE user_email = ? AND course_code = ? AND status IN ('active', 'completed')")
    .bind(userEmail, courseCode).run();
  if (!evaluation.certificateEnabled || !evaluation.certificatePreauthorised || evaluation.certificatePaymentRequired) return { evaluation, certificate: null };

  const learner = await db.prepare("SELECT full_name FROM users WHERE email = ? AND role = 'learner' LIMIT 1")
    .bind(userEmail).first<{ full_name: string }>();
  if (!learner) return { evaluation, certificate: null };
  const course=await db.prepare("SELECT created_by_email FROM course_drafts WHERE code=? AND status='active'").bind(courseCode).first<{created_by_email:string}>();
  const facilitator=course?await db.prepare("SELECT signatory_name,signatory_title,file_key FROM certificate_signatures WHERE signature_key=?").bind(`facilitator:${course.created_by_email}`).first<{signatory_name:string;signatory_title:string;file_key:string}>():null;
  const provost=await db.prepare("SELECT signatory_name,signatory_title,file_key FROM certificate_signatures WHERE signature_key='provost'").first<{signatory_name:string;signatory_title:string;file_key:string}>();
  const configuration = evaluation.certificateConfiguration;
  const requirementsJson = JSON.stringify({ evaluatedAt: new Date().toISOString(), requirements: evaluation.requirements, certificateConfiguration: configuration, certificateAuthorization: { preauthorised: evaluation.certificatePreauthorised, authority: evaluation.certificateAuthorizationAuthority, approvalReference: evaluation.certificateAuthorizationReference } });
  const certificateCode = `UCC-${new Date().getUTCFullYear()}-${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
  const includeUcc = requiresUccSignatory(configuration.issuanceModel);
  const includeAcademicLead = configuration.showAcademicLead && !["jointly_issued", "partner_issued"].includes(configuration.issuanceModel);
  await db.prepare(`INSERT OR IGNORE INTO certificates(
    certificate_code,user_email,learner_name,course_code,course_title,issuer_name,
    award_type,issuance_model,partner_name,partner_logo_key,partner_signatory_name,partner_signatory_title,partner_signature_key,
    cpd_hours,cpd_points,professional_approval_body,professional_approval_reference,show_academic_lead,
    requirements_json,credit_value,learning_mode,facilitator_name,facilitator_title,facilitator_signature_key,provost_name,provost_title,provost_signature_key
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(
      certificateCode,userEmail,learner.full_name,evaluation.courseCode,evaluation.courseTitle,certificateIssuerName(configuration),
      configuration.awardType,configuration.issuanceModel,configuration.partnerName||null,configuration.partnerLogoKey||null,configuration.partnerSignatoryName||null,configuration.partnerSignatoryTitle||null,configuration.partnerSignatureKey||null,
      configuration.cpdHours,configuration.cpdPoints,configuration.approvalBody||null,configuration.approvalReference||null,includeAcademicLead?1:0,
      requirementsJson,evaluation.creditValue,evaluation.learningMode,
      includeAcademicLead?(facilitator?.signatory_name??null):null,includeAcademicLead?(facilitator?.signatory_title??null):null,includeAcademicLead?(facilitator?.file_key??null):null,
      includeUcc?(provost?.signatory_name??null):null,includeUcc?(provost?.signatory_title??null):null,includeUcc?(provost?.file_key??null):null,
    ).run();
  const certificate = await db.prepare("SELECT certificate_code,learner_name,course_code,course_title,issuer_name,requirements_json,credential_type,status,issued_at,expires_at,revoked_at,revocation_reason,credit_value,learning_mode,award_type,issuance_model,partner_name,partner_logo_key,partner_signatory_name,partner_signatory_title,partner_signature_key,cpd_hours,cpd_points,professional_approval_body,professional_approval_reference,show_academic_lead,facilitator_name,facilitator_title,facilitator_signature_key,provost_name,provost_title,provost_signature_key FROM certificates WHERE user_email = ? AND course_code = ? LIMIT 1")
    .bind(userEmail, courseCode).first<IssuedCertificate>();
  await issueBroaderCredentialsIfEligible(userEmail);
  return { evaluation, certificate };
}
