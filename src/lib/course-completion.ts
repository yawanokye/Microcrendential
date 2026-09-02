import { getRawDb } from "@/db/raw";

type CourseActivity = {
  id?: string;
  kind?: "colab" | "virtual_lab";
  title?: string;
  required?: boolean;
  practicalId?: string;
};

export type CompletionRequirement = {
  id: string;
  type: "identity" | "assessment" | "virtual_lab" | "colab";
  label: string;
  complete: boolean;
  evidence?: string;
};

export type CompletionEvaluation = {
  courseCode: string;
  courseTitle: string;
  certificateEnabled: boolean;
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
};

const parseActivities = (value: string) => {
  try {
    const parsed = JSON.parse(value || "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is CourseActivity => Boolean(item && typeof item === "object")) : [];
  } catch {
    return [];
  }
};

export async function evaluateCourseCompletion(userEmail: string, courseCode: string): Promise<CompletionEvaluation | null> {
  const db = getRawDb();
  const course = await db.prepare("SELECT code, title, activities_json, certificate_enabled FROM course_drafts WHERE code = ? AND status = 'active' LIMIT 1")
    .bind(courseCode).first<{ code: string; title: string; activities_json: string; certificate_enabled: number }>();
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

  for (const [index, activity] of parseActivities(course.activities_json).filter((item) => item.required !== false).entries()) {
    if (activity.kind === "virtual_lab") {
      const practicalId = String(activity.practicalId ?? "").trim();
      const submission = practicalId ? await db.prepare("SELECT id, mark, assessed_at FROM virtual_lab_submissions WHERE learner_email = ? AND practical_id = ? AND passed = 1 ORDER BY assessed_at DESC, id DESC LIMIT 1")
        .bind(userEmail, practicalId).first<{ id: number; mark: number | null; assessed_at: string | null }>() : null;
      requirements.push({
        id: String(activity.id || `virtual-lab-${index + 1}`),
        type: "virtual_lab",
        label: activity.title?.trim() || "Required virtual practical",
        complete: Boolean(submission),
        evidence: submission ? `Submission ${submission.id} · ${submission.mark ?? 0}% · ${submission.assessed_at ?? "assessed"}` : "Competent submission required",
      });
    }
    if (activity.kind === "colab") {
      const title = String(activity.title ?? "").trim();
      const assignment = title ? await db.prepare("SELECT id FROM colab_assignments WHERE course_code = ? AND title = ? AND status = 'active' ORDER BY id DESC LIMIT 1")
        .bind(course.code, title).first<{ id: number }>() : null;
      const submission = assignment ? await db.prepare("SELECT id, mark, assessed_at FROM colab_submissions WHERE assignment_id = ? AND learner_email = ? AND passed = 1 ORDER BY assessed_at DESC, id DESC LIMIT 1")
        .bind(assignment.id, userEmail).first<{ id: number; mark: number | null; assessed_at: string | null }>() : null;
      requirements.push({
        id: String(activity.id || `colab-${index + 1}`),
        type: "colab",
        label: activity.title?.trim() || "Required Colab activity",
        complete: Boolean(submission),
        evidence: submission ? `Submission ${submission.id} · ${submission.mark ?? 0} marks · ${submission.assessed_at ?? "assessed"}` : "Passing notebook evidence required",
      });
    }
  }

  return {
    courseCode: course.code,
    courseTitle: course.title,
    certificateEnabled: Boolean(course.certificate_enabled),
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
  if (!evaluation.certificateEnabled) return { evaluation, certificate: null };

  const learner = await db.prepare("SELECT full_name FROM users WHERE email = ? AND role = 'learner' LIMIT 1")
    .bind(userEmail).first<{ full_name: string }>();
  if (!learner) return { evaluation, certificate: null };
  const requirementsJson = JSON.stringify({ evaluatedAt: new Date().toISOString(), requirements: evaluation.requirements });
  const certificateCode = `UCC-${new Date().getUTCFullYear()}-${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
  await db.prepare("INSERT OR IGNORE INTO certificates (certificate_code, user_email, learner_name, course_code, course_title, issuer_name, requirements_json) VALUES (?, ?, ?, ?, ?, 'University of Cape Coast', ?)")
    .bind(certificateCode, userEmail, learner.full_name, evaluation.courseCode, evaluation.courseTitle, requirementsJson).run();
  const certificate = await db.prepare("SELECT certificate_code, learner_name, course_code, course_title, issuer_name, requirements_json, credential_type, status, issued_at, expires_at, revoked_at, revocation_reason FROM certificates WHERE user_email = ? AND course_code = ? LIMIT 1")
    .bind(userEmail, courseCode).first<IssuedCertificate>();
  return { evaluation, certificate };
}
