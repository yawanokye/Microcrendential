import { getRawDb } from "@/db/raw";
import { requireActiveProfile } from "@/lib/accounts";
import { normalizeCourseDesign } from "@/lib/course-design";

type CredentialRow = { certificate_code: string; learner_name: string; course_code: string; course_title: string; issued_at: string; credential_type: string; status: string; expires_at: string | null; discipline: string | null; description: string | null };
type EnrolmentRow = { course_code: string; title: string; discipline: string; status: string; enrolled_at: string };
type PracticalRow = { practical_id: string; discipline: string; practical_title: string; mark: number | null; competency_note: string; assessed_at: string | null };
type CoursePathRow = { code: string; title: string; design_json: string };

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
  const courseRows = await db.prepare("SELECT code,title,design_json FROM course_drafts WHERE status='active'").all<CoursePathRow>();

  let interests: string[] = [];
  try { interests = JSON.parse(account.profile.interests_json || "[]") as string[]; } catch { interests = []; }

  const activeCredentialCodes = new Set(credentials.results.filter((item) => item.status === "active").map((item) => item.course_code.toUpperCase()));
  const enrolmentMap = new Map(enrolments.results.map((item) => [item.course_code.toUpperCase(), item.status]));
  const titleMap = new Map(courseRows.results.map((item) => [item.code.toUpperCase(), item.title]));
  const pathwayMap = new Map<string, { code: string; title: string; requiredCodes: Set<string> }>();
  for (const course of courseRows.results) {
    let design: ReturnType<typeof normalizeCourseDesign>;
    try { design = normalizeCourseDesign(JSON.parse(course.design_json || "{}")); } catch { continue; }
    const code = design.broaderCredentialCode.trim().toUpperCase();
    const title = design.broaderCredentialTitle.trim();
    if (!code || !title) continue;
    const current = pathwayMap.get(code) ?? { code, title, requiredCodes: new Set<string>() };
    current.title = title;
    for (const component of design.broaderCredentialRequiredCodes) if (component.trim()) current.requiredCodes.add(component.trim().toUpperCase());
    current.requiredCodes.add(course.code.toUpperCase());
    pathwayMap.set(code, current);
  }
  const pathways = [...pathwayMap.values()].map((pathway) => {
    const requiredCodes = [...pathway.requiredCodes];
    const components = requiredCodes.map((code) => ({
      code,
      title: titleMap.get(code) ?? code,
      completed: activeCredentialCodes.has(code),
      inProgress: !activeCredentialCodes.has(code) && enrolmentMap.get(code) === "active",
    }));
    const completedCount = components.filter((item) => item.completed).length;
    const inProgressCount = components.filter((item) => item.inProgress).length;
    const totalCount = components.length;
    return {
      code: pathway.code,
      title: pathway.title,
      requiredCodes,
      components,
      completedCount,
      inProgressCount,
      totalCount,
      progress: totalCount ? Math.round((completedCount / totalCount) * 100) : 0,
      complete: totalCount >= 2 && completedCount === totalCount,
    };
  }).filter((item) => item.totalCount >= 2).sort((a, b) => b.progress - a.progress || b.inProgressCount - a.inProgressCount || a.title.localeCompare(b.title));

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
