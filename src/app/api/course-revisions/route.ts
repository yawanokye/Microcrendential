import { getRawDb } from "@/db/raw";
import { requireActiveProfile } from "@/lib/accounts";
import { evaluateCourseQuality, normalizeCourseDesign, type CourseMaterialRecord } from "@/lib/course-design";
import { plainTextFromHtml, sanitizeReadableHtml } from "@/lib/document-content";

type CourseSourceRow = {
  id: number;
  code: string;
  title: string;
  discipline: string;
  description: string;
  materials_json: string;
  activities_json: string;
  assessment_modes_json: string;
  assessment_config_json: string;
  design_json: string;
  gate_required: number;
  question_limit: number;
  certificate_enabled: number;
  status: string;
  created_by_email: string;
  version_number: number;
};

type RevisionRow = {
  id: number;
  course_id: number;
  base_version_number: number;
  payload_json: string;
  status: string;
  created_by_email: string;
  facilitator_name: string | null;
  version_number: number;
  submitted_at: string | null;
  review_comment: string | null;
  reviewed_by_email: string | null;
  reviewed_at: string | null;
  updated_at: string;
  created_at: string;
};

type RevisionPayload = {
  code: string;
  title: string;
  discipline: string;
  description: string;
  materials: CourseMaterialRecord[];
  activities: unknown[];
  assessmentModes: string[];
  assessmentConfig: Record<string, unknown>;
  design: ReturnType<typeof normalizeCourseDesign>;
  gateRequired: boolean;
  questionLimit: number;
  certificateEnabled: boolean;
};

const parseJson = <T>(value: string, fallback: T) => {
  try { return JSON.parse(value || "") as T; } catch { return fallback; }
};

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
    const hasOriginalFile = Boolean(fileKey || item.fileName || item.mimeType);
    return {
      id: String(item.id || `material-${index + 1}`).slice(0, 80),
      title: String(item.title || "Untitled learning block").trim().slice(0, 240),
      kind: String(item.kind || "Read").trim().slice(0, 50),
      source: String(item.source || "Course author").trim().slice(0, 240),
      url: normalizeUrl(item.url), externalUrl: normalizeUrl(item.externalUrl), fileKey,
      fileName: hasOriginalFile ? String(item.fileName || "course-material").slice(0, 240) : undefined,
      mimeType: hasOriginalFile ? String(item.mimeType || "application/octet-stream").slice(0, 120) : undefined,
      readableHtml: readableHtml || undefined, plainText: plainText || undefined,
      sectionId: String(item.sectionId || "").slice(0, 80) || undefined,
      sectionTitle: String(item.sectionTitle || "").trim().slice(0, 200) || undefined,
      unitTitle: String(item.unitTitle || "").trim().slice(0, 200) || undefined,
      estimatedMinutes: Math.min(600, Math.max(1, Number(item.estimatedMinutes) || Math.ceil((plainText.split(/\s+/).filter(Boolean).length || 200) / 200))),
      outcomeIds, accessibilityChecked: Boolean(item.accessibilityChecked), license: String(item.license || "").trim().slice(0, 200) || undefined,
      transcript: String(item.transcript || "").slice(0, 300_000) || undefined,
      transcriptLanguage: String(item.transcriptLanguage || "").slice(0, 80) || undefined,
      transcriptSource: String(item.transcriptSource || "").slice(0, 240) || undefined,
      transcriptPublished: Boolean(item.transcriptPublished),
    };
  });
}

function normalizePayload(value: Record<string, unknown>): RevisionPayload {
  const assessmentConfig = value.assessmentConfig && typeof value.assessmentConfig === "object" ? value.assessmentConfig as Record<string, unknown> : {};
  return {
    code: String(value.code ?? "").trim().toUpperCase().slice(0, 80),
    title: String(value.title ?? "").trim().slice(0, 240),
    discipline: String(value.discipline ?? "").trim().slice(0, 160),
    description: String(value.description ?? "").trim().slice(0, 5000),
    materials: normalizeMaterials(value.materials),
    activities: Array.isArray(value.activities) ? value.activities.slice(0, 100) : [],
    assessmentModes: Array.isArray(value.assessmentModes) ? value.assessmentModes.map(String).slice(0, 20) : [],
    assessmentConfig,
    design: normalizeCourseDesign(value.design),
    gateRequired: value.gateRequired !== false,
    questionLimit: Math.min(100, Math.max(1, Number(value.questionLimit) || 10)),
    certificateEnabled: value.certificateEnabled !== false,
  };
}

function sourcePayload(row: CourseSourceRow): RevisionPayload {
  return normalizePayload({
    code: row.code, title: row.title, discipline: row.discipline, description: row.description,
    materials: parseJson(row.materials_json, []), activities: parseJson(row.activities_json, []),
    assessmentModes: parseJson(row.assessment_modes_json, []), assessmentConfig: parseJson(row.assessment_config_json, {}),
    design: parseJson(row.design_json, {}), gateRequired: Boolean(row.gate_required), questionLimit: row.question_limit,
    certificateEnabled: Boolean(row.certificate_enabled),
  });
}

function qualityFor(payload: RevisionPayload) {
  const questions = Array.isArray(payload.assessmentConfig.questions) ? payload.assessmentConfig.questions : [];
  return evaluateCourseQuality({ title: payload.title, description: payload.description, design: payload.design, materials: payload.materials, questionCount: questions.slice(0, payload.questionLimit).length });
}

function validateForReview(payload: RevisionPayload) {
  if (!payload.title || !payload.code || !payload.discipline) return "Course title, code and discipline are required.";
  const quality = qualityFor(payload);
  if (!quality.ready) return `Complete the publish-readiness checks before review: ${quality.checks.filter((check) => !check.passed).map((check) => check.label).join(", ")}.`;
  return "";
}

function present(row: RevisionRow) {
  const payload = normalizePayload(parseJson<Record<string, unknown>>(row.payload_json, {}));
  return {
    ...payload,
    id: row.id,
    sourceCourseId: row.course_id,
    isRevision: true,
    status: row.status,
    createdByEmail: row.created_by_email,
    facilitatorName: row.facilitator_name ?? row.created_by_email,
    baseVersionNumber: row.base_version_number,
    versionNumber: row.version_number,
    submittedAt: row.submitted_at,
    reviewComment: row.review_comment,
    reviewedByEmail: row.reviewed_by_email,
    reviewedAt: row.reviewed_at,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}

export async function GET() {
  const account = await requireActiveProfile(["facilitator", "admin"]);
  if (account.error || !account.profile) return account.error;
  const db = getRawDb();
  const select = `SELECT r.*, u.full_name AS facilitator_name FROM course_revisions r LEFT JOIN users u ON u.email = r.created_by_email`;
  const rows = account.profile.role === "admin"
    ? await db.prepare(`${select} WHERE r.status <> 'approved' ORDER BY CASE r.status WHEN 'pending_review' THEN 0 WHEN 'rejected' THEN 1 ELSE 2 END, r.updated_at DESC LIMIT 250`).all<RevisionRow>()
    : await db.prepare(`${select} WHERE r.created_by_email = ? AND r.status <> 'approved' ORDER BY r.updated_at DESC LIMIT 100`).bind(account.profile.email).all<RevisionRow>();
  return Response.json({ revisions: rows.results.map(present) });
}

export async function POST(request: Request) {
  const account = await requireActiveProfile(["facilitator", "admin"]);
  if (account.error || !account.profile) return account.error;
  const payload = await request.json() as { courseId?: number };
  const courseId = Number(payload.courseId);
  if (!Number.isInteger(courseId) || courseId < 1) return Response.json({ error: "Choose an active course to revise." }, { status: 400 });
  const db = getRawDb();
  const source = await db.prepare("SELECT * FROM course_drafts WHERE id = ? AND status = 'active' LIMIT 1").bind(courseId).first<CourseSourceRow>();
  if (!source) return Response.json({ error: "The active course was not found." }, { status: 404 });
  if (account.profile.role !== "admin" && source.created_by_email !== account.profile.email) return Response.json({ error: "You can revise only your own active courses." }, { status: 403 });
  const existing = await db.prepare(`SELECT r.*, u.full_name AS facilitator_name FROM course_revisions r LEFT JOIN users u ON u.email = r.created_by_email
    WHERE r.course_id = ? AND r.status IN ('draft','pending_review','rejected') ORDER BY r.updated_at DESC LIMIT 1`)
    .bind(courseId).first<RevisionRow>();
  if (existing) return Response.json({ revision: present(existing), existing: true });
  const result = await db.prepare(`INSERT INTO course_revisions (course_id, base_version_number, payload_json, status, created_by_email, updated_at)
    VALUES (?, ?, ?, 'draft', ?, CURRENT_TIMESTAMP)`).bind(courseId, source.version_number, JSON.stringify(sourcePayload(source)), account.profile.email).run();
  const created = await db.prepare(`SELECT r.*, u.full_name AS facilitator_name FROM course_revisions r LEFT JOIN users u ON u.email = r.created_by_email WHERE r.id = ? LIMIT 1`)
    .bind(Number(result.meta.last_row_id)).first<RevisionRow>();
  return Response.json({ revision: created ? present(created) : null, existing: false }, { status: 201 });
}

export async function PUT(request: Request) {
  const account = await requireActiveProfile(["facilitator", "admin"]);
  if (account.error || !account.profile) return account.error;
  const value = await request.json() as Record<string, unknown>;
  const id = Number(value.id); const expectedVersion = Number(value.expectedVersion);
  if (!Number.isInteger(id) || id < 1 || !Number.isInteger(expectedVersion) || expectedVersion < 1) return Response.json({ error: "A valid revision and version are required." }, { status: 400 });
  const db = getRawDb();
  const existing = await db.prepare("SELECT created_by_email, status, version_number FROM course_revisions WHERE id = ? LIMIT 1").bind(id).first<{ created_by_email: string; status: string; version_number: number }>();
  if (!existing) return Response.json({ error: "The course revision was not found." }, { status: 404 });
  if (account.profile.role !== "admin" && existing.created_by_email !== account.profile.email) return Response.json({ error: "You can edit only your own course revisions." }, { status: 403 });
  if (existing.status === "pending_review") return Response.json({ error: "This revision is awaiting approval and cannot be edited. Ask an administrator to return it with comments first." }, { status: 409 });
  if (existing.status === "approved") return Response.json({ error: "This revision has already been published." }, { status: 409 });
  if (existing.version_number !== expectedVersion) return Response.json({ error: "This revision changed in another session. Reload it before saving." }, { status: 409 });
  const payload = normalizePayload(value);
  if (!payload.title || !payload.code || !payload.discipline) return Response.json({ error: "Course title, code and discipline are required." }, { status: 400 });
  const submissionMode = value.submissionMode === "review" ? "review" : "draft";
  if (submissionMode === "review") { const error = validateForReview(payload); if (error) return Response.json({ error, quality: qualityFor(payload) }, { status: 400 }); }
  const status = submissionMode === "review" ? "pending_review" : "draft";
  const result = await db.prepare(`UPDATE course_revisions SET payload_json = ?, status = ?, version_number = version_number + 1,
    submitted_at = CASE WHEN ? = 'pending_review' THEN CURRENT_TIMESTAMP ELSE submitted_at END,
    review_comment = CASE WHEN ? = 'pending_review' THEN NULL ELSE review_comment END,
    reviewed_by_email = CASE WHEN ? = 'pending_review' THEN NULL ELSE reviewed_by_email END,
    reviewed_at = CASE WHEN ? = 'pending_review' THEN NULL ELSE reviewed_at END,
    updated_at = CURRENT_TIMESTAMP WHERE id = ? AND version_number = ?`)
    .bind(JSON.stringify(payload), status, status, status, status, status, id, expectedVersion).run();
  if (!result.meta.changes) return Response.json({ error: "The revision version changed before it could be saved." }, { status: 409 });
  return Response.json({ course: { id, sourceCourseId: null, isRevision: true, code: payload.code, title: payload.title, status, versionNumber: expectedVersion + 1 }, quality: qualityFor(payload) });
}

export async function PATCH(request: Request) {
  const account = await requireActiveProfile(["admin"]);
  if (account.error || !account.profile) return account.error;
  const value = await request.json() as { id?: number; status?: "active" | "rejected"; comment?: string; administrativeOverride?: boolean };
  const id = Number(value.id); const reviewComment = String(value.comment ?? "").trim().slice(0, 4000);
  if (!Number.isInteger(id) || id < 1 || !["active", "rejected"].includes(value.status ?? "")) return Response.json({ error: "Choose a revision and review decision." }, { status: 400 });
  if (value.status === "rejected" && !reviewComment) return Response.json({ error: "Add review comments explaining what must change." }, { status: 400 });
  const db = getRawDb();
  const revision = await db.prepare("SELECT * FROM course_revisions WHERE id = ? LIMIT 1").bind(id).first<RevisionRow>();
  if (!revision) return Response.json({ error: "The course revision was not found." }, { status: 404 });
  if (revision.status !== "pending_review" && revision.status !== "rejected") return Response.json({ error: "Only submitted or returned revisions can receive a decision." }, { status: 409 });
  const payload = normalizePayload(parseJson<Record<string, unknown>>(revision.payload_json, {}));
  const quality = qualityFor(payload);
  const administrativeOverride = value.status === "active" && !quality.ready;
  if (administrativeOverride && value.administrativeOverride !== true) return Response.json({ error: "This revision requires a recorded administrator exception.", quality, requiresAdministrativeOverride: true }, { status: 409 });
  if (administrativeOverride && !reviewComment) return Response.json({ error: "Add an administrator justification before approving this revision as an exception." }, { status: 400 });
  const source = await db.prepare("SELECT version_number, code FROM course_drafts WHERE id = ? AND status = 'active' LIMIT 1").bind(revision.course_id).first<{ version_number: number; code: string }>();
  if (!source) return Response.json({ error: "The currently published course was not found." }, { status: 404 });
  if (value.status === "active" && source.version_number !== revision.base_version_number) return Response.json({ error: "The live course changed after this revision began. Create a fresh revision from the current version." }, { status: 409 });
  if (value.status === "rejected") {
    await db.prepare("UPDATE course_revisions SET status = 'rejected', review_comment = ?, reviewed_by_email = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(reviewComment, account.profile.email, id).run();
    return Response.json({ updated: true, status: "rejected" });
  }
  if (payload.code !== source.code) return Response.json({ error: "A revision cannot change the public course code. Create a new course when a new code is required." }, { status: 409 });
  const liveUpdate = await db.prepare(`UPDATE course_drafts SET title = ?, discipline = ?, description = ?, materials_json = ?, activities_json = ?,
    assessment_modes_json = ?, assessment_config_json = ?, design_json = ?, gate_required = ?, question_limit = ?, certificate_enabled = ?,
    version_number = version_number + 1, activated_by_email = ?, activated_at = CURRENT_TIMESTAMP,
    review_comment = ?, reviewed_by_email = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status = 'active' AND version_number = ?`)
    .bind(payload.title, payload.discipline, payload.description, JSON.stringify(payload.materials), JSON.stringify(payload.activities),
      JSON.stringify(payload.assessmentModes), JSON.stringify(payload.assessmentConfig), JSON.stringify(payload.design), payload.gateRequired ? 1 : 0,
      payload.questionLimit, payload.certificateEnabled ? 1 : 0, account.profile.email, reviewComment || "Revision approved and published.",
      account.profile.email, revision.course_id, revision.base_version_number).run();
  if (!liveUpdate.meta.changes) return Response.json({ error: "The live version changed before approval. Open the current course and apply the edits again." }, { status: 409 });
  await db.prepare("UPDATE course_revisions SET status = 'approved', review_comment = ?, reviewed_by_email = ?, reviewed_at = CURRENT_TIMESTAMP, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(reviewComment || "Revision approved and published.", account.profile.email, id).run();
  return Response.json({ updated: true, status: "active", administrativeOverride, publishedVersion: revision.base_version_number + 1 });
}
