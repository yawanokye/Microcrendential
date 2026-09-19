import { getRawDb } from "@/db/raw";
import { requireActiveProfile } from "@/lib/accounts";
import { normalizeCourseDesign } from "@/lib/course-design";

type CourseRow = { code: string; title: string; design_json: string };
type CertificateRow = { course_code: string };

type Pathway = {
  code: string;
  title: string;
  requiredCodes: string[];
  components: { code: string; title: string; completed: boolean }[];
  completedCodes: string[];
  completedCount: number;
  totalCount: number;
  progress: number;
  complete: boolean;
};

export async function GET() {
  const account = await requireActiveProfile(["learner"]);
  if (account.error || !account.profile) return account.error;
  const db = getRawDb();
  const courses = await db.prepare("SELECT code,title,design_json FROM course_drafts WHERE status='active' ORDER BY title").all<CourseRow>();
  const certs = await db.prepare("SELECT course_code FROM certificates WHERE user_email=? AND status='active'").bind(account.profile.email).all<CertificateRow>();
  const completed = new Set(certs.results.map((item) => item.course_code.trim().toUpperCase()));
  const courseTitle = new Map(courses.results.map((item) => [item.code.trim().toUpperCase(), item.title]));
  const grouped = new Map<string, { title: string; required: Set<string> }>();
  for (const course of courses.results) {
    let design;
    try { design = normalizeCourseDesign(JSON.parse(course.design_json || "{}")); } catch { design = normalizeCourseDesign({}); }
    if (design.credentialStructure === "broader") {
      const code = course.code.trim().toUpperCase();
      if (!code || design.componentCredentialCodes.length < 2) continue;
      grouped.set(code, { title: course.title, required: new Set(design.componentCredentialCodes.map((item) => item.trim().toUpperCase()).filter(Boolean)) });
      continue;
    }
    // Backward compatibility for legacy component-defined pathways.
    const code = design.broaderCredentialCode.trim().toUpperCase();
    const title = design.broaderCredentialTitle.trim();
    if (!code || !title) continue;
    const entry = grouped.get(code) ?? { title, required: new Set<string>() };
    design.broaderCredentialRequiredCodes.forEach((item) => entry.required.add(item.trim().toUpperCase()));
    entry.required.add(course.code.trim().toUpperCase());
    grouped.set(code, entry);
  }
  const pathways: Pathway[] = [...grouped.entries()].map(([code, item]) => {
    const requiredCodes = [...item.required].filter(Boolean);
    const completedCodes = requiredCodes.filter((component) => completed.has(component));
    const totalCount = requiredCodes.length;
    const completedCount = completedCodes.length;
    return {
      code,
      title: item.title,
      requiredCodes,
      components: requiredCodes.map((component) => ({ code: component, title: courseTitle.get(component) ?? component, completed: completed.has(component) })),
      completedCodes,
      completedCount,
      totalCount,
      progress: totalCount ? Math.round((completedCount / totalCount) * 100) : 0,
      complete: totalCount >= 2 && completedCount === totalCount,
    };
  }).filter((item) => item.totalCount >= 2);
  return Response.json({ pathways });
}
