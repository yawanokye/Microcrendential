import { getRawDb } from "@/db/raw";
import { requireActiveProfile } from "@/lib/accounts";
import { evaluateCourseQuality, normalizeCourseDesign, type CourseMaterialRecord } from "@/lib/course-design";
import { plainTextFromHtml, sanitizeReadableHtml } from "@/lib/document-content";
import { learnerSafeAssessmentConfig, type AssessmentConfigRecord } from "@/lib/assessment-policy";
import { rejectCrossSiteMutation } from "@/lib/request-security";
import { recordAudit } from "@/lib/audit";

type CourseRow = {
  id: number; code: string; title: string; discipline: string; description: string; materials_json: string; activities_json: string; assessment_modes_json: string;
  assessment_config_json: string; design_json: string; gate_required: number; question_limit: number; certificate_enabled: number; certificate_preapproved: number; status: string;
  approval_authority: string | null; approval_meeting_date: string | null; approval_reference: string | null; approval_decision: string | null; approval_conditions: string | null; approval_conditions_satisfied: number; approval_effective_date: string | null; approval_review_date: string | null; approval_document_reference: string | null; approval_recorded_by_email: string | null; approval_recorded_at: string | null;
  created_by_email: string; facilitator_name: string | null; activated_at: string | null; submitted_at: string | null; review_comment: string | null; reviewed_by_email: string | null; reviewed_at: string | null; version_number: number; updated_at: string | null; created_at: string;
};

const parseJson = <T>(value: string, fallback: T) => { try { return JSON.parse(value || "") as T; } catch { return fallback; } };

function normalizeUrl(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;
  try { const url = new URL(raw); return ["http:", "https:"].includes(url.protocol) ? url.toString().slice(0, 3000) : undefined; } catch { return undefined; }
}

function normalizeMaterials(value: unknown): CourseMaterialRecord[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 250).map((entry, index) => {
    const item = entry && typeof entry === "object" ? entry as Partial<CourseMaterialRecord> : {};
    const readableHtml = sanitizeReadableHtml(String(item.readableHtml ?? ""));
    const plainText = plainTextFromHtml(readableHtml) || String(item.plainText ?? "").trim().slice(0, 300_000);
    const outcomeIds = Array.isArray(item.outcomeIds) ? item.outcomeIds.map((outcome) => String(outcome).slice(0, 80)).filter(Boolean).slice(0, 20) : [];
    const fileKey = /^course-materials\/[a-zA-Z0-9/_\-.]+$/.test(String(item.fileKey ?? "")) ? String(item.fileKey) : undefined;
    const inlineAssetKeys = Array.isArray(item.inlineAssetKeys)
      ? item.inlineAssetKeys.map(String).filter((key) => /^course-materials\/[a-zA-Z0-9/_\-.]+$/.test(key)).slice(0, 40)
      : [];
    const url = normalizeUrl(item.url);
    const hasOriginalFile = Boolean(fileKey || item.fileName || item.mimeType);
    return {
      id: String(item.id || `material-${index + 1}`).slice(0, 80), title: String(item.title || "Untitled learning block").trim().slice(0, 240),
      kind: String(item.kind || "Read").trim().slice(0, 50), source: String(item.source || "Course author").trim().slice(0, 240),
      url, externalUrl: normalizeUrl(item.externalUrl), fileKey, inlineAssetKeys: inlineAssetKeys.length ? inlineAssetKeys : undefined,
      fileName: hasOriginalFile ? String(item.fileName || "course-material").slice(0, 240) : undefined,
      mimeType: hasOriginalFile ? String(item.mimeType || "application/octet-stream").slice(0, 120) : undefined,
      readableHtml: readableHtml || undefined, plainText: plainText || undefined,
      sectionId: String(item.sectionId || "").slice(0, 80) || undefined, sectionTitle: String(item.sectionTitle || "").trim().slice(0, 200) || undefined,
      unitTitle: String(item.unitTitle || "").trim().slice(0, 200) || undefined,
      estimatedMinutes: Math.min(600, Math.max(1, Number(item.estimatedMinutes) || Math.ceil((plainText.split(/\s+/).filter(Boolean).length || 200) / 200))),
      outcomeIds, accessibilityChecked: Boolean(item.accessibilityChecked), license: String(item.license || "").trim().slice(0, 200) || undefined,
      transcript: String(item.transcript || "").slice(0, 300_000) || undefined,
      transcriptLanguage: String(item.transcriptLanguage || "").slice(0, 80) || undefined,
      transcriptSource: String(item.transcriptSource || "").slice(0, 240) || undefined, transcriptPublished: Boolean(item.transcriptPublished), required: item.required !== false,
    };
  });
}

function present(row: CourseRow) {
  return {
    id: row.id, code: row.code, title: row.title, discipline: row.discipline, description: row.description,
    materials: parseJson<CourseMaterialRecord[]>(row.materials_json, []), activities: parseJson<unknown[]>(row.activities_json, []),
    assessmentModes: parseJson<string[]>(row.assessment_modes_json, []), assessmentConfig: parseJson<Record<string, unknown>>(row.assessment_config_json, {}),
    design: normalizeCourseDesign(parseJson(row.design_json, {})), gateRequired: Boolean(row.gate_required), questionLimit: row.question_limit,
    certificateEnabled: Boolean(row.certificate_enabled), certificatePreapproved: Boolean(row.certificate_preapproved), status: row.status, createdByEmail: row.created_by_email,
    approvalRecord: { authorityName: row.approval_authority, meetingDate: row.approval_meeting_date, reference: row.approval_reference, decision: row.approval_decision, conditions: row.approval_conditions, conditionsSatisfied: Boolean(row.approval_conditions_satisfied), effectiveDate: row.approval_effective_date, reviewDate: row.approval_review_date, documentReference: row.approval_document_reference, recordedByEmail: row.approval_recorded_by_email, recordedAt: row.approval_recorded_at, certificatePreapproved: Boolean(row.certificate_preapproved) },
    facilitatorName: row.facilitator_name ?? row.created_by_email, activatedAt: row.activated_at, submittedAt: row.submitted_at,
    reviewComment: row.review_comment, reviewedByEmail: row.reviewed_by_email, reviewedAt: row.reviewed_at,
    versionNumber: row.version_number || 1, updatedAt: row.updated_at ?? row.created_at, createdAt: row.created_at,
  };
}

type PresentedCourse = ReturnType<typeof present>;
type LearnerPresentedCourse = Omit<PresentedCourse, "approvalRecord" | "certificatePreapproved" | "reviewComment" | "reviewedByEmail" | "reviewedAt" | "submittedAt">;

function learnerVisibleCourse(course: PresentedCourse): LearnerPresentedCourse {
  const { approvalRecord, certificatePreapproved, reviewComment, reviewedByEmail, reviewedAt, submittedAt, ...safe } = course;
  return safe;
}

function catalogueOnly(course:LearnerPresentedCourse){return{...course,enrolled:false,materials:course.materials.map((m)=>({id:m.id,title:m.title,kind:m.kind,source:m.source,sectionId:m.sectionId,sectionTitle:m.sectionTitle,unitTitle:m.unitTitle,estimatedMinutes:m.estimatedMinutes,outcomeIds:m.outcomeIds,required:m.required})),activities:course.activities.map((entry)=>{const a=entry&&typeof entry==="object"?entry as Record<string,unknown>:{};return{id:a.id,kind:a.kind,title:a.title,required:a.required,passMark:a.passMark};}),assessmentConfig:{passMark:Number((course.assessmentConfig as {passMark?:number}).passMark)||70,attempts:String((course.assessmentConfig as {attempts?:string}).attempts||"1"),questionCount:Array.isArray((course.assessmentConfig as {questions?:unknown[]}).questions)?(course.assessmentConfig as {questions:unknown[]}).questions.length:0}};}

function normalizedPayload(payload: Record<string, unknown>) {
  const title = String(payload.title ?? "").trim().slice(0, 240); const code = String(payload.code ?? "").trim().toUpperCase().slice(0, 80);
  const discipline = String(payload.discipline ?? "").trim().slice(0, 160); const description = String(payload.description ?? "").trim().slice(0, 5000);
  const design = normalizeCourseDesign(payload.design); const materials = normalizeMaterials(payload.materials);
  const activities = Array.isArray(payload.activities) ? payload.activities.slice(0, 100) : [];
  const assessmentModes = Array.isArray(payload.assessmentModes) ? payload.assessmentModes.map(String).slice(0, 20) : [];
  const assessmentConfig = payload.assessmentConfig && typeof payload.assessmentConfig === "object" ? payload.assessmentConfig as Record<string, unknown> : {};
  const questions = Array.isArray(assessmentConfig.questions) ? assessmentConfig.questions : [];
  const questionLimit = Math.min(100, Math.max(1, Number(payload.questionLimit) || 10));
  const quality = evaluateCourseQuality({ title, description, design, materials, questionCount: questions.slice(0, questionLimit).length, assessmentConfig: assessmentConfig as AssessmentConfigRecord, activities: activities as Parameters<typeof evaluateCourseQuality>[0]["activities"] });
  return { title, code, discipline, description, design, materials, activities, assessmentModes, assessmentConfig, questionLimit, quality };
}

function validateForReview(course: ReturnType<typeof normalizedPayload>) {
  if (!course.title || !course.code || !course.discipline) return "Course title, code and discipline are required.";
  if (!course.quality.ready) {
    const missing = course.quality.checks.filter((check) => !check.passed).map((check) => check.label).join(", ");
    return `Complete the publish-readiness checks before review: ${missing}.`;
  }
  return "";
}

export async function GET() {
  const account = await requireActiveProfile();
  if (account.error || !account.profile) return account.error;
  const select = "SELECT c.*, u.full_name AS facilitator_name FROM course_drafts c LEFT JOIN users u ON u.email = c.created_by_email";
  const db = getRawDb(); let rows;
  if (account.profile.role === "learner") rows = await db.prepare(`${select} WHERE c.status = 'active' ORDER BY c.activated_at DESC, c.created_at DESC LIMIT 100`).all<CourseRow>();
  else if (account.profile.role === "facilitator") rows = await db.prepare(`${select} WHERE c.created_by_email = ? OR c.status = 'active' ORDER BY c.updated_at DESC, c.created_at DESC LIMIT 150`).bind(account.profile.email).all<CourseRow>();
  else rows = await db.prepare(`${select} ORDER BY CASE c.status WHEN 'pending_review' THEN 0 WHEN 'active' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END, c.updated_at DESC, c.created_at DESC LIMIT 250`).all<CourseRow>();
  if(account.profile.role==="learner"){const enrolledRows=await db.prepare("SELECT course_code FROM enrollments WHERE user_email=? AND status IN ('active','completed')").bind(account.profile.email).all<{course_code:string}>();const enrolled=new Set(enrolledRows.results.map(r=>r.course_code));return Response.json({courses:rows.results.map(present).map(course=>{const safe=learnerVisibleCourse(course);return enrolled.has(course.code)?{...safe,enrolled:true,assessmentConfig:learnerSafeAssessmentConfig(course.assessmentConfig as AssessmentConfigRecord,course.questionLimit)}:catalogueOnly(safe);})});}
  return Response.json({ courses: rows.results.map(present) });
}

export async function POST(request: Request) {
  const originError=rejectCrossSiteMutation(request);if(originError)return originError;
  const account = await requireActiveProfile(["facilitator", "admin"]);
  if (account.error || !account.profile) return account.error;
  const payload = await request.json() as Record<string, unknown>; const course = normalizedPayload(payload);
  if (!course.title || !course.code || !course.discipline) return Response.json({ error: "Course title, code and discipline are required." }, { status: 400 });
  const submissionMode = payload.submissionMode === "review" ? "review" : "draft";
  if (submissionMode === "review") { const error = validateForReview(course); if (error) return Response.json({ error, quality: course.quality }, { status: 400 }); }
  const db = getRawDb(); const existing = await db.prepare("SELECT id FROM course_drafts WHERE code = ? LIMIT 1").bind(course.code).first();
  if (existing) return Response.json({ error: "That course code is already in use. Open the existing draft to continue editing." }, { status: 409 });
  const status = submissionMode === "review" ? "pending_review" : "draft";
  const result = await db.prepare("INSERT INTO course_drafts (code, title, discipline, description, materials_json, activities_json, assessment_modes_json, assessment_config_json, design_json, gate_required, question_limit, certificate_enabled, status, created_by_email, submitted_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 'pending_review' THEN CURRENT_TIMESTAMP ELSE NULL END, CURRENT_TIMESTAMP)")
    .bind(course.code, course.title, course.discipline, course.description, JSON.stringify(course.materials), JSON.stringify(course.activities), JSON.stringify(course.assessmentModes), JSON.stringify(course.assessmentConfig), JSON.stringify(course.design), payload.gateRequired === false ? 0 : 1, course.questionLimit, payload.certificateEnabled === false ? 0 : 1, status, account.profile.email, status).run();
  await recordAudit(account.profile.email,"course.created",{courseCode:course.code,status});
  return Response.json({ course: { id: result.meta.last_row_id, code: course.code, title: course.title, discipline: course.discipline, status, versionNumber: 1 }, quality: course.quality }, { status: 201 });
}

export async function PUT(request: Request) {
  const originError=rejectCrossSiteMutation(request);if(originError)return originError;
  const account = await requireActiveProfile(["facilitator", "admin"]);
  if (account.error || !account.profile) return account.error;
  const payload = await request.json() as Record<string, unknown>; const id = Number(payload.id); const expectedVersion = Number(payload.expectedVersion);
  if (!Number.isInteger(id) || id < 1 || !Number.isInteger(expectedVersion) || expectedVersion < 1) return Response.json({ error: "A valid draft and version are required." }, { status: 400 });
  const db = getRawDb();
  const existing = await db.prepare("SELECT created_by_email, status, version_number FROM course_drafts WHERE id = ? LIMIT 1").bind(id).first<{ created_by_email: string; status: string; version_number: number }>();
  if (!existing) return Response.json({ error: "Course draft was not found." }, { status: 404 });
  if (account.profile.role !== "admin" && existing.created_by_email !== account.profile.email) return Response.json({ error: "You can edit only your own course drafts." }, { status: 403 });
  if (existing.status === "active") return Response.json({ error: "An active course is locked. Create a new version through the quality-governance process." }, { status: 409 });
  if (existing.version_number !== expectedVersion) return Response.json({ error: "This draft changed in another session. Reload the latest version before saving." }, { status: 409 });
  const course = normalizedPayload(payload);
  if (!course.title || !course.code || !course.discipline) return Response.json({ error: "Course title, code and discipline are required." }, { status: 400 });
  const duplicate = await db.prepare("SELECT id FROM course_drafts WHERE code = ? AND id <> ? LIMIT 1").bind(course.code, id).first();
  if (duplicate) return Response.json({ error: "That course code belongs to another course." }, { status: 409 });
  const submissionMode = payload.submissionMode === "review" ? "review" : "draft";
  if (submissionMode === "review") { const error = validateForReview(course); if (error) return Response.json({ error, quality: course.quality }, { status: 400 }); }
  const status = submissionMode === "review" ? "pending_review" : "draft";
  const result = await db.prepare("UPDATE course_drafts SET code = ?, title = ?, discipline = ?, description = ?, materials_json = ?, activities_json = ?, assessment_modes_json = ?, assessment_config_json = ?, design_json = ?, gate_required = ?, question_limit = ?, certificate_enabled = ?, status = ?, version_number = version_number + 1, submitted_at = CASE WHEN ? = 'pending_review' THEN CURRENT_TIMESTAMP ELSE submitted_at END, review_comment = CASE WHEN ? = 'pending_review' THEN NULL ELSE review_comment END, reviewed_by_email = CASE WHEN ? = 'pending_review' THEN NULL ELSE reviewed_by_email END, reviewed_at = CASE WHEN ? = 'pending_review' THEN NULL ELSE reviewed_at END, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND version_number = ?")
    .bind(course.code, course.title, course.discipline, course.description, JSON.stringify(course.materials), JSON.stringify(course.activities), JSON.stringify(course.assessmentModes), JSON.stringify(course.assessmentConfig), JSON.stringify(course.design), payload.gateRequired === false ? 0 : 1, course.questionLimit, payload.certificateEnabled === false ? 0 : 1, status, status, status, status, status, id, expectedVersion).run();
  if (!result.meta.changes) return Response.json({ error: "The draft version changed before it could be saved." }, { status: 409 });
  await recordAudit(account.profile.email,"course.saved",{courseId:id,courseCode:course.code,status,version:expectedVersion+1});
  return Response.json({ course: { id, code: course.code, title: course.title, status, versionNumber: expectedVersion + 1 }, quality: course.quality });
}

export async function PATCH(request: Request) {
  const originError=rejectCrossSiteMutation(request);if(originError)return originError;
  const account = await requireActiveProfile(["admin"]);
  if (account.error || !account.profile) return account.error;
  const payload = await request.json() as {
    id?: number;
    status?: "active" | "pending_review" | "rejected";
    comment?: string;
    approvalRecord?: {
      authorityName?: string; meetingDate?: string; reference?: string; decision?: "approved" | "approved_with_conditions";
      conditions?: string; conditionsSatisfied?: boolean; effectiveDate?: string; reviewDate?: string; documentReference?: string; certificatePreapproved?: boolean;
    };
  };
  if (!payload.id || !["active", "pending_review", "rejected"].includes(payload.status ?? "")) return Response.json({ error: "Choose a course and valid review decision." }, { status: 400 });
  const reviewComment = String(payload.comment ?? "").trim().slice(0, 4000);
  if (payload.status === "rejected" && !reviewComment) return Response.json({ error: "Add a review comment explaining what the facilitator must change before returning the course." }, { status: 400 });
  const active = payload.status === "active"; const db = getRawDb();
  const course = await db.prepare("SELECT code, title, description, design_json, materials_json, activities_json, assessment_config_json, certificate_enabled, created_by_email, status FROM course_drafts WHERE id = ? LIMIT 1").bind(payload.id).first<{ code: string; title: string; description: string; design_json: string; materials_json: string; activities_json: string; assessment_config_json: string; certificate_enabled: number; created_by_email: string; status: string }>();
  if (!course) return Response.json({ error: "Course was not found." }, { status: 404 });
  if (active) {
    const design = normalizeCourseDesign(parseJson(course.design_json, {})); const materials = normalizeMaterials(parseJson(course.materials_json, []));
    const assessment = parseJson<AssessmentConfigRecord>(course.assessment_config_json, {});
    const activities=parseJson<Parameters<typeof evaluateCourseQuality>[0]["activities"]>(course.activities_json,[]);
    const quality = evaluateCourseQuality({ title: course.title, description: course.description, design, materials, questionCount: assessment.questions?.length ?? 0, assessmentConfig:assessment,activities });
    if (course.status !== "pending_review") return Response.json({ error: "Only a submitted course can be activated from a recorded committee decision.", quality }, { status: 409 });
    if(!quality.ready)return Response.json({error:"Activation is blocked until every publish-readiness check passes.",quality},{status:409});
    const approval = payload.approvalRecord ?? {};
    const authorityName = String(approval.authorityName ?? "").trim().slice(0, 300);
    const meetingDate = String(approval.meetingDate ?? "").trim().slice(0, 40);
    const reference = String(approval.reference ?? "").trim().slice(0, 240);
    const decision = approval.decision;
    const conditions = String(approval.conditions ?? "").trim().slice(0, 4000);
    if (!authorityName || !meetingDate || !reference || !["approved", "approved_with_conditions"].includes(decision ?? "")) return Response.json({ error: "Record the committee/authority, meeting date, decision and minute/reference number before activation." }, { status: 400 });
    if (decision === "approved_with_conditions" && !conditions) return Response.json({ error: "Record the conditions attached to the committee decision." }, { status: 400 });
    if (decision === "approved_with_conditions" && !approval.conditionsSatisfied) return Response.json({ error: "Confirm that all approval conditions are satisfied before activation." }, { status: 409 });
    if (course.certificate_enabled && !approval.certificatePreapproved) return Response.json({ error: "Confirm that certificate issuance is pre-authorised for this approved programme before activation." }, { status: 409 });
  }
  const decisionComment = reviewComment || (active ? "Committee decision recorded and programme activated." : null);
  const approval = payload.approvalRecord ?? {};
  const result = active
    ? await db.prepare("UPDATE course_drafts SET status = ?, activated_by_email = ?, activated_at = CURRENT_TIMESTAMP, review_comment = ?, reviewed_by_email = ?, reviewed_at = CURRENT_TIMESTAMP, certificate_preapproved = ?, approval_authority = ?, approval_meeting_date = ?, approval_reference = ?, approval_decision = ?, approval_conditions = ?, approval_conditions_satisfied = ?, approval_effective_date = ?, approval_review_date = ?, approval_document_reference = ?, approval_recorded_by_email = ?, approval_recorded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(payload.status, account.profile.email, decisionComment, account.profile.email, approval.certificatePreapproved ? 1 : 0, String(approval.authorityName ?? "").trim().slice(0, 300), String(approval.meetingDate ?? "").trim().slice(0, 40), String(approval.reference ?? "").trim().slice(0, 240), approval.decision ?? null, String(approval.conditions ?? "").trim().slice(0, 4000) || null, approval.conditionsSatisfied ? 1 : 0, String(approval.effectiveDate ?? "").trim().slice(0, 40) || null, String(approval.reviewDate ?? "").trim().slice(0, 40) || null, String(approval.documentReference ?? "").trim().slice(0, 500) || null, account.profile.email, payload.id).run()
    : await db.prepare("UPDATE course_drafts SET status = ?, activated_by_email = NULL, activated_at = NULL, review_comment = ?, reviewed_by_email = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(payload.status, decisionComment, account.profile.email, payload.id).run();
  if (!result.meta.changes) return Response.json({ error: "Course was not found." }, { status: 404 });
  await recordAudit(account.profile.email,active?"course.activated_from_committee_record":"course.returned",{courseId:payload.id,courseCode:course.code,comment:decisionComment,approvalReference:active?payload.approvalRecord?.reference:null,approvalAuthority:active?payload.approvalRecord?.authorityName:null});
  if (active) {
    let activities: { id?: string; kind?: string; title?: string; instructions?: string; notebookKey?: string; notebookFileName?: string; templateUrl?: string; rubric?: string; maxMark?: number; passMark?: number; attemptsAllowed?: number; dueAt?: string }[] = [];
    try { activities = JSON.parse(course.activities_json || "[]") as typeof activities; } catch { activities = []; }
    for (const activity of activities.filter((item) => item.kind === "colab" && item.notebookKey && item.notebookFileName)) {
      const exists = await db.prepare("SELECT id FROM colab_assignments WHERE course_code = ? AND title = ? LIMIT 1").bind(course.code, activity.title ?? "Colab coding activity").first<{ id: number }>();
      if (exists) continue;
      await db.prepare("INSERT INTO colab_assignments (course_code, title, instructions, template_file_key, template_file_name, template_url, rubric, max_mark, pass_mark, attempts_allowed, due_at, status, created_by_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)")
        .bind(course.code, activity.title ?? "Colab coding activity", activity.instructions ?? "Complete the notebook in free Google Colab and submit your evidence.", activity.notebookKey, activity.notebookFileName, activity.templateUrl || null, activity.rubric ?? "Assess correctness, interpretation and reproducibility.", Math.min(1000, Math.max(1, Number(activity.maxMark) || 100)), Math.min(100, Math.max(1, Number(activity.passMark) || 60)), Math.min(10, Math.max(1, Number(activity.attemptsAllowed) || 2)), activity.dueAt || null, course.created_by_email).run();
    }
  }
  return Response.json({ updated: true, status: payload.status });
}
