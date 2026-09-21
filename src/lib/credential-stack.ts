import { getRawDb } from "@/db/raw";
import { normalizeCourseDesign } from "@/lib/course-design";
import { certificateIssuerName, requiresUccSignatory, type CertificateConfiguration } from "@/lib/certificate-policy";

type PathCourseRow = { code: string; title: string; design_json: string; created_by_email: string; certificate_enabled: number; certificate_preapproved: number };
type ActiveCertificateRow = { course_code: string };

type StackDefinition = {
  code: string;
  title: string;
  requiredCodes: Set<string>;
  sourceCourses: Set<string>;
  awardEnabled: boolean;
  configuration: CertificateConfiguration;
  createdByEmail: string;
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
        definitions.set(code, { code, title: course.title.trim(), requiredCodes: new Set(requiredCodes), sourceCourses: new Set(requiredCodes), awardEnabled: Boolean(course.certificate_enabled && course.certificate_preapproved), configuration: design.certificate, createdByEmail: course.created_by_email });
      }
      continue;
    }
    // Backward compatibility for older component records created before broader credentials became first-class programmes.
    const code = design.broaderCredentialCode.trim().toUpperCase();
    const title = design.broaderCredentialTitle.trim();
    if (!code || !title) continue;
    const definition = definitions.get(code) ?? { code, title, requiredCodes: new Set<string>(), sourceCourses: new Set<string>(), awardEnabled: true, configuration: design.certificate, createdByEmail: course.created_by_email };
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
    const configuration = definition.configuration;
    const requirementsJson = JSON.stringify({ evaluatedAt: new Date().toISOString(), stackableCredential: { code: definition.code, title: definition.title, requiredCodes }, certificateConfiguration: configuration, requirements });
    const facilitator = configuration.showAcademicLead && !["jointly_issued", "partner_issued"].includes(configuration.issuanceModel)
      ? await db.prepare("SELECT signatory_name,signatory_title,file_key FROM certificate_signatures WHERE signature_key=?").bind(`facilitator:${definition.createdByEmail}`).first<{signatory_name:string;signatory_title:string;file_key:string}>()
      : null;
    const includeUcc = requiresUccSignatory(configuration.issuanceModel);
    await db.prepare(`INSERT OR IGNORE INTO certificates(
      certificate_code,user_email,learner_name,course_code,course_title,issuer_name,
      award_type,issuance_model,partner_name,partner_logo_key,partner_signatory_name,partner_signatory_title,partner_signature_key,
      cpd_hours,cpd_points,professional_approval_body,professional_approval_reference,show_academic_lead,
      requirements_json,credential_type,credit_value,learning_mode,facilitator_name,facilitator_title,facilitator_signature_key,provost_name,provost_title,provost_signature_key
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'stacked_credential',?,'stacked',?,?,?,?,?,?)`)
      .bind(
        certificateCode,userEmail,learner.full_name,definition.code,definition.title,certificateIssuerName(configuration),
        configuration.awardType,configuration.issuanceModel,configuration.partnerName||null,configuration.partnerLogoKey||null,configuration.partnerSignatoryName||null,configuration.partnerSignatoryTitle||null,configuration.partnerSignatureKey||null,
        configuration.cpdHours,configuration.cpdPoints,configuration.approvalBody||null,configuration.approvalReference||null,configuration.showAcademicLead?1:0,
        requirementsJson,componentCredits,
        facilitator?.signatory_name??null,facilitator?.signatory_title??null,facilitator?.file_key??null,
        includeUcc?(provost?.signatory_name??null):null,includeUcc?(provost?.signatory_title??null):null,includeUcc?(provost?.file_key??null):null,
      ).run();
    const created = await db.prepare("SELECT certificate_code FROM certificates WHERE user_email=? AND course_code=? LIMIT 1").bind(userEmail, definition.code).first<{ certificate_code: string }>();
    if (created) { issued.push(created.certificate_code); earnedCodes.add(definition.code); }
  }
  return issued;
}
