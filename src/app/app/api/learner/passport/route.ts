import { getRawDb } from "@/db/raw";
import { requireActiveProfile } from "@/lib/accounts";

type CredentialRow = { certificate_code: string; learner_name: string; course_code: string; course_title: string; issued_at: string; credential_type: string; status: string; expires_at: string | null; discipline: string | null; description: string | null };
type EnrolmentRow = { course_code: string; title: string; discipline: string; status: string; enrolled_at: string };
type PracticalRow = { practical_id: string; discipline: string; practical_title: string; mark: number | null; competency_note: string; assessed_at: string | null };

export async function GET() {
  const account = await requireActiveProfile(["learner"]);
  if (account.error || !account.profile) return account.error;
  const db = getRawDb(); const email = account.profile.email;
  const credentials = await db.prepare(`
    SELECT cert.certificate_code, cert.learner_name, cert.course_code, cert.course_title,
      cert.issued_at, cert.credential_type, cert.status, cert.expires_at,
      c.discipline, c.description
    FROM certificates cert
    LEFT JOIN course_drafts c ON c.code = cert.course_code
    WHERE cert.user_email = ?
    ORDER BY cert.issued_at DESC
  `).bind(email).all<CredentialRow>();
  const enrolments = await db.prepare(`
    SELECT e.course_code, c.title, c.discipline, e.status, e.enrolled_at
    FROM enrollments e JOIN course_drafts c ON c.code = e.course_code
    WHERE e.user_email = ? ORDER BY e.enrolled_at DESC
  `).bind(email).all<EnrolmentRow>();
  const practicals = await db.prepare(`
    SELECT practical_id, discipline, practical_title, mark, competency_note, assessed_at
    FROM virtual_lab_submissions
    WHERE learner_email = ? AND passed = 1
    ORDER BY assessed_at DESC LIMIT 50
  `).bind(email).all<PracticalRow>();
  let interests: string[] = [];
  try { interests = JSON.parse(account.profile.interests_json || "[]") as string[]; } catch { interests = []; }
  const disciplines = new Set<string>([
    ...interests,
    ...credentials.results.map((item) => item.discipline || "Interdisciplinary"),
    ...enrolments.results.map((item) => item.discipline || "Interdisciplinary"),
  ]);
  const pathways = [...disciplines].map((discipline) => {
    const earned = credentials.results.filter((item) => (item.discipline || "Interdisciplinary") === discipline && item.status === "active").length;
    const inProgress = enrolments.results.filter((item) => item.discipline === discipline && item.status === "active").length;
    const required = 3;
    return { discipline, earned, inProgress, required, progress: Math.min(100, Math.round((earned / required) * 100)), nextMilestone: earned >= required ? `${discipline} pathway achieved` : `${required - earned} more verified credential${required - earned === 1 ? "" : "s"} to pathway recognition` };
  }).sort((a, b) => b.progress - a.progress || b.inProgress - a.inProgress);
  return Response.json({
    student: {
      studentNumber: account.profile.student_number,
      fullName: account.profile.full_name,
      email,
      educationLevel: account.profile.education_level,
      occupation: account.profile.occupation,
      organisation: account.profile.organisation,
      interests,
      preferredLanguage: account.profile.preferred_language,
    },
    credentials: credentials.results.map((item) => ({ ...item, sharePath: `/verify-credential?code=${encodeURIComponent(item.certificate_code)}` })),
    enrolments: enrolments.results,
    competencies: practicals.results,
    pathways,
    generatedAt: new Date().toISOString(),
  });
}
