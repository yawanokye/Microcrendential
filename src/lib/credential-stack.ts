import { getRawDb } from "@/db/raw";
import { normalizeCourseDesign } from "@/lib/course-design";

type PathCourseRow = { code: string; title: string; design_json: string; created_by_email: string; certificate_enabled: number; certificate_preapproved: number };
type ActiveCertificateRow = { course_code: string };

type StackDefinition = {
  code: string;
  title: string;
  requiredCodes: Set<string>;
  sourceCourses: Set<string>;
  awardEnabled: boolean;
};

function collectDefinitions(courses: PathCourseRow[]) {
  const definitions = new Map<string, StackDefinition>();
  for (const course of courses) {
    let design: ReturnType<typeof normalizeCourseDesign>;
    try { design = normalizeCourseDesign(JSON.parse(course.design_json || "{}")); } catch { continue; }
    if (design.credentialStructure === "broader") {
      const code = course.code.trim().toUpperCase();
      const requiredCodes = design.componentCredentialCodes.map((item) => item.trim().toUpperCase()).filter(Boolean);
      if (code && course.title.trim() && requiredCodes.length >= 2) {
        definitions.set(code, { code, title: course.title.trim(), requiredCodes: new Set(requiredCodes), sourceCourses: new Set(requiredCodes), awardEnabled: Boolean(course.certificate_enabled && course.certificate_preapproved) });
      }
      continue;
    }
    // Backward compatibility for older component records created before broader credentials became first-class programmes.
    const code = design.broaderCredentialCode.trim().toUpperCase();
    const title = design.broaderCredentialTitle.trim();
    if (!code || !title) continue;
    const definition = definitions.get(code) ?? { code, title, requiredCodes: new Set<string>(), sourceCourses: new Set<string>(), awardEnabled: true };
    definition.title = title;
    definition.sourceCourses.add(course.code.toUpperCase());
    definition.requiredCodes.add(course.code.toUpperCase());
    for (const component of design.broaderCredentialRequiredCodes) if (component.trim()) definition.requiredCodes.add(component.trim().toUpperCase());
    definitions.set(code, definition);
  }
  return [...definitions.values()].filter((item) => item.requiredCodes.size >= 2);
}

export async function issueBroaderCredentialsIfEligible(userEmail: string) {
  const db = getRawDb();
  const learner = await db.prepare("SELECT full_name FROM users WHERE email=? AND role='learner' LIMIT 1").bind(userEmail).first<{ full_name: string }>();
  if (!learner) return [] as string[];
  const courses = await db.prepare("SELECT code,title,design_json,created_by_email,certificate_enabled,certificate_preapproved FROM course_drafts WHERE status='active'").all<PathCourseRow>();
  const definitions = collectDefinitions(courses.results);
  if (!definitions.length) return [] as string[];
  const certificates = await db.prepare("SELECT course_code FROM certificates WHERE user_email=? AND status='active'").bind(userEmail).all<ActiveCertificateRow>();
  const earnedCodes = new Set(certificates.results.map((item) => item.course_code.toUpperCase()));
  const courseDesigns = new Map(courses.results.map((course) => {
    try { return [course.code.toUpperCase(), normalizeCourseDesign(JSON.parse(course.design_json || "{}"))] as const; }
    catch { return [course.code.toUpperCase(), normalizeCourseDesign({})] as const; }
  }));
  const provost = await db.prepare("SELECT signatory_name,signatory_title,file_key FROM certificate_signatures WHERE signature_key='provost'").first<{ signatory_name: string; signatory_title: string; file_key: string }>();
  const issued: string[] = [];
  for (const definition of definitions) {
    if (!definition.awardEnabled) continue;
    const requiredCodes = [...definition.requiredCodes];
    if (!requiredCodes.every((code) => earnedCodes.has(code))) continue;
    const existing = await db.prepare("SELECT certificate_code FROM certificates WHERE user_email=? AND course_code=? LIMIT 1").bind(userEmail, definition.code).first<{ certificate_code: string }>();
    if (existing) continue;
    const componentCredits = requiredCodes.reduce((total, code) => total + (courseDesigns.get(code)?.creditValue ?? 0), 0);
    const requirements = requiredCodes.map((code) => ({ id: `component-${code}`, type: "component_credential", label: `Completed component credential ${code}`, complete: true, evidence: "Verified active credential in the UCC credential register" }));
    const certificateCode = `UCC-${new Date().getUTCFullYear()}-${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
    const requirementsJson = JSON.stringify({ evaluatedAt: new Date().toISOString(), stackableCredential: { code: definition.code, title: definition.title, requiredCodes }, requirements });
    await db.prepare(`INSERT OR IGNORE INTO certificates(certificate_code,user_email,learner_name,course_code,course_title,issuer_name,requirements_json,credential_type,credit_value,learning_mode,provost_name,provost_title,provost_signature_key) VALUES(?,?,?,?,?,'University of Cape Coast',?,'stacked_credential',?,'stacked',?,?,?)`)
      .bind(certificateCode,userEmail,learner.full_name,definition.code,definition.title,requirementsJson,componentCredits,provost?.signatory_name??null,provost?.signatory_title??null,provost?.file_key??null).run();
    const created = await db.prepare("SELECT certificate_code FROM certificates WHERE user_email=? AND course_code=? LIMIT 1").bind(userEmail, definition.code).first<{ certificate_code: string }>();
    if (created) { issued.push(created.certificate_code); earnedCodes.add(definition.code); }
  }
  return issued;
}
