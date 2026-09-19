import { validateAssessmentForPublication, type AssessmentConfigRecord } from "@/lib/assessment-policy";

export type LearningOutcome = {
  id: string;
  statement: string;
  assessmentMethod: string;
  skill: string;
};

export type CourseSection = {
  id: string;
  title: string;
  description: string;
};

export type ProgrammeInitiationSource = "code" | "academic_unit" | "joint" | "external_need" | "other" | "existing_record";
export type CredentialStructure = "standalone" | "component" | "broader";
export type ComponentOutcomeMapping = { broaderOutcomeId: string; componentCourseCode: string; componentOutcomeIds: string[] };

export type CourseDesign = {
  category: "credit" | "professional" | "rpl";
  deliveryPattern: "asynchronous" | "synchronous" | "blended";
  level: "foundation" | "applied" | "advanced";
  language: string;
  expectedHours: number;
  enrolmentMode: "open" | "application" | "invitation";
  priceGhs: number;
  certificateFeeGhs: number;
  creditValue: number;
  programmeInitiationSource: ProgrammeInitiationSource;
  originatingUnit: string;
  programmeHome: string;
  contributingUnits: string[];
  identifiedNeed: string;
  credentialStructure: CredentialStructure;
  componentCredentialCodes: string[];
  componentOutcomeMappings: ComponentOutcomeMapping[];
  broaderCredentialCode: string;
  broaderCredentialTitle: string;
  broaderCredentialRequiredCodes: string[];
  intendedAudience: string;
  prerequisites: string;
  accessibilityStatement: string;
  objectives: string[];
  outcomes: LearningOutcome[];
  skills: string[];
  sections: CourseSection[];
};

export type CourseMaterialRecord = {
  id?: string;
  title: string;
  kind: string;
  source: string;
  url?: string;
  externalUrl?: string;
  fileKey?: string;
  fileName?: string;
  mimeType?: string;
  inlineAssetKeys?: string[];
  readableHtml?: string;
  plainText?: string;
  sectionId?: string;
  sectionTitle?: string;
  unitTitle?: string;
  estimatedMinutes?: number;
  outcomeIds?: string[];
  accessibilityChecked?: boolean;
  license?: string;
  transcript?: string;
  transcriptLanguage?: string;
  transcriptSource?: string;
  transcriptPublished?: boolean;
  displayMode?: "in_frame" | "new_tab";
  linkedVideoUrl?: string;
  linkedVideoDisplay?: "in_frame" | "new_tab";
  required?: boolean;
};

export const defaultCourseDesign = (): CourseDesign => ({
  category: "professional",
  deliveryPattern: "blended",
  level: "applied",
  language: "English",
  expectedHours: 24,
  enrolmentMode: "open",
  priceGhs: 0,
  certificateFeeGhs: 0,
  creditValue: 0,
  programmeInitiationSource: "academic_unit",
  originatingUnit: "",
  programmeHome: "",
  contributingUnits: [],
  identifiedNeed: "",
  credentialStructure: "standalone",
  componentCredentialCodes: [],
  componentOutcomeMappings: [],
  broaderCredentialCode: "",
  broaderCredentialTitle: "",
  broaderCredentialRequiredCodes: [],
  intendedAudience: "Professionals, students and lifelong learners seeking applied capability in this field.",
  prerequisites: "No formal prerequisite. Basic digital literacy and reliable internet access are recommended.",
  accessibilityStatement: "Readable HTML, keyboard-accessible activities, descriptive labels and reviewed transcripts will be provided wherever applicable.",
  objectives: [
    "Build practical understanding through short, guided and evidence-based learning activities.",
    "Enable learners to demonstrate a workplace-relevant capability through assessed evidence.",
  ],
  outcomes: [
    { id: "outcome-1", statement: "Explain the core concepts and terminology used in this field.", assessmentMethod: "Objective knowledge check", skill: "Conceptual understanding" },
    { id: "outcome-2", statement: "Apply the concepts to an authentic professional or community task.", assessmentMethod: "Applied assignment or practical evidence", skill: "Applied problem-solving" },
  ],
  skills: ["Critical thinking", "Digital literacy", "Evidence-based decision-making"],
  sections: [{ id: "section-1", title: "Orientation and foundations", description: "Course orientation, essential concepts and the first guided practice." }],
});

const cleanList = (value: unknown, maximum = 20) => Array.isArray(value)
  ? value.map((item) => String(item ?? "").trim()).filter(Boolean).slice(0, maximum)
  : [];

export function normalizeCourseDesign(value: unknown): CourseDesign {
  const fallback = defaultCourseDesign();
  const input = value && typeof value === "object" ? value as Partial<CourseDesign> : {};
  const categories = new Set<CourseDesign["category"]>(["credit", "professional", "rpl"]);
  const deliveries = new Set<CourseDesign["deliveryPattern"]>(["asynchronous", "synchronous", "blended"]);
  const levels = new Set<CourseDesign["level"]>(["foundation", "applied", "advanced"]);
  const initiationSources = new Set<ProgrammeInitiationSource>(["code", "academic_unit", "joint", "external_need", "other", "existing_record"]);
  const credentialStructures = new Set<CredentialStructure>(["standalone", "component", "broader"]);
  const outcomes = Array.isArray(input.outcomes) ? input.outcomes.map((item, index) => {
    const outcome = item && typeof item === "object" ? item as Partial<LearningOutcome> : {};
    return {
      id: String(outcome.id || `outcome-${index + 1}`).slice(0, 80),
      statement: String(outcome.statement || "").trim().slice(0, 600),
      assessmentMethod: String(outcome.assessmentMethod || "").trim().slice(0, 300),
      skill: String(outcome.skill || "").trim().slice(0, 200),
    };
  }).filter((item) => item.statement).slice(0, 20) : [];
  const sections = Array.isArray(input.sections) ? input.sections.map((item, index) => {
    const section = item && typeof item === "object" ? item as Partial<CourseSection> : {};
    return {
      id: String(section.id || `section-${index + 1}`).slice(0, 80),
      title: String(section.title || "").trim().slice(0, 200),
      description: String(section.description || "").trim().slice(0, 600),
    };
  }).filter((item) => item.title).slice(0, 30) : [];
  const expectedHours = Math.min(500, Math.max(1, Number(input.expectedHours) || fallback.expectedHours));
  const priceGhs = Math.min(1_000_000, Math.max(0, Number(input.priceGhs) || 0));
  const certificateFeeGhs = Math.min(1_000_000, Math.max(0, Number(input.certificateFeeGhs) || 0));
  const creditValue = Math.min(60, Math.max(0, Number(input.creditValue) || 0));
  return {
    category: categories.has(input.category as CourseDesign["category"]) ? input.category as CourseDesign["category"] : fallback.category,
    deliveryPattern: deliveries.has(input.deliveryPattern as CourseDesign["deliveryPattern"]) ? input.deliveryPattern as CourseDesign["deliveryPattern"] : fallback.deliveryPattern,
    level: levels.has(input.level as CourseDesign["level"]) ? input.level as CourseDesign["level"] : fallback.level,
    language: String(input.language || fallback.language).trim().slice(0, 80),
    expectedHours,
    // Institution-wide policy: every published offering supports learner self-enrolment.
    enrolmentMode: "open",
    priceGhs,
    certificateFeeGhs,
    creditValue,
    programmeInitiationSource: initiationSources.has(input.programmeInitiationSource as ProgrammeInitiationSource) ? input.programmeInitiationSource as ProgrammeInitiationSource : fallback.programmeInitiationSource,
    originatingUnit: String(input.originatingUnit || "").trim().slice(0, 300),
    programmeHome: String(input.programmeHome || "").trim().slice(0, 300),
    contributingUnits: cleanList(input.contributingUnits, 30).map((item) => item.slice(0, 300)),
    identifiedNeed: String(input.identifiedNeed || "").trim().slice(0, 3000),
    credentialStructure: credentialStructures.has(input.credentialStructure as CredentialStructure) ? input.credentialStructure as CredentialStructure : fallback.credentialStructure,
    componentCredentialCodes: cleanList(input.componentCredentialCodes, 30).map((item) => item.toUpperCase().slice(0, 120)),
    componentOutcomeMappings: Array.isArray(input.componentOutcomeMappings) ? input.componentOutcomeMappings.map((entry) => {
      const item = entry && typeof entry === "object" ? entry as Partial<ComponentOutcomeMapping> : {};
      return {
        broaderOutcomeId: String(item.broaderOutcomeId || "").slice(0, 80),
        componentCourseCode: String(item.componentCourseCode || "").trim().toUpperCase().slice(0, 120),
        componentOutcomeIds: cleanList(item.componentOutcomeIds, 30).map((value) => value.slice(0, 80)),
      };
    }).filter((item) => item.broaderOutcomeId && item.componentCourseCode && item.componentOutcomeIds.length).slice(0, 200) : [],
    broaderCredentialCode: String(input.broaderCredentialCode || "").trim().toUpperCase().slice(0, 120),
    broaderCredentialTitle: String(input.broaderCredentialTitle || "").trim().slice(0, 300),
    broaderCredentialRequiredCodes: cleanList(input.broaderCredentialRequiredCodes, 30).map((item) => item.toUpperCase().slice(0, 120)),
    intendedAudience: String(input.intendedAudience || "").trim().slice(0, 2000),
    prerequisites: String(input.prerequisites || "").trim().slice(0, 2000),
    accessibilityStatement: String(input.accessibilityStatement || "").trim().slice(0, 2000),
    objectives: cleanList(input.objectives, 20).map((item) => item.slice(0, 600)),
    outcomes,
    skills: cleanList(input.skills, 30).map((item) => item.slice(0, 160)),
    sections: sections.length ? sections : fallback.sections,
  };
}

export type CourseQualityCheck = { id: string; label: string; passed: boolean; detail: string };

export function evaluateCourseQuality(input: {
  title?: string;
  description?: string;
  design: CourseDesign;
  materials: CourseMaterialRecord[];
  questionCount: number;
  assessmentConfig?: AssessmentConfigRecord;
  activities?: { required?: boolean; title?: string; instructions?: string; rubric?: string; correctAnswer?: string; passMark?: number; attemptsAllowed?: number; sectionId?: string; gradingMode?: string }[];
}) {
  const { title = "", description = "", design, materials, questionCount, assessmentConfig, activities = [] } = input;
  const sectionIds = new Set(design.sections.map((section) => section.id));
  const mappedOutcomes = new Set(materials.flatMap((material) => material.outcomeIds ?? []));
  const isBroaderCredential = design.credentialStructure === "broader";
  const componentCodes = new Set(design.componentCredentialCodes);
  const mappedBroaderOutcomes = new Set(design.componentOutcomeMappings.filter((mapping) => componentCodes.has(mapping.componentCourseCode) && mapping.componentOutcomeIds.length).map((mapping) => mapping.broaderOutcomeId));
  const legacyStackingValid = !design.broaderCredentialCode && !design.broaderCredentialTitle && design.broaderCredentialRequiredCodes.length === 0 ? true : Boolean(design.broaderCredentialCode && design.broaderCredentialTitle && design.broaderCredentialRequiredCodes.length >= 2);
  const checks: CourseQualityCheck[] = [
    { id: "identity", label: "Clear course identity", passed: title.trim().length >= 8 && description.trim().length >= 80, detail: "Use a specific title and a learner-facing description of at least 80 characters." },
    { id: "governance", label: "Programme source and home", passed: Boolean(design.programmeInitiationSource && design.originatingUnit.trim().length >= 2 && design.programmeHome.trim().length >= 2), detail: "Record the programme initiation source, originating unit and programme home. These are governance records and do not create a separate approval pathway." },
    { id: "stacking", label: isBroaderCredential ? "Approved component credentials" : "Credential pathway metadata", passed: isBroaderCredential ? design.componentCredentialCodes.length >= 2 : legacyStackingValid, detail: isBroaderCredential ? "A broader credential must consolidate at least two existing component microcredentials." : "Component relationships are normally defined by the broader credential after the component course is built." },
    { id: "audience", label: "Audience and prerequisites", passed: design.intendedAudience.length >= 20 && design.prerequisites.length >= 10, detail: "State who the course serves and what learners need before starting." },
    { id: "objectives", label: "Course objectives", passed: design.objectives.length >= 2, detail: "Provide at least two clear design objectives." },
    { id: "outcomes", label: "Measurable outcomes", passed: design.outcomes.length >= 2 && design.outcomes.every((outcome) => outcome.assessmentMethod && outcome.skill), detail: "Provide at least two outcomes, each with a skill and assessment method." },
    { id: "structure", label: isBroaderCredential ? "Component curriculum consolidated" : "Structured curriculum", passed: isBroaderCredential ? design.componentCredentialCodes.length >= 2 : design.sections.length >= 1 && materials.length >= 2 && materials.every((material) => material.sectionId && sectionIds.has(material.sectionId)), detail: isBroaderCredential ? "The broader credential reuses the approved curriculum of its selected component credentials; do not duplicate their learning blocks." : "Add at least two learning blocks and place every block in a section." },
    { id: "alignment", label: isBroaderCredential ? "Broader outcomes mapped to components" : "Outcome alignment", passed: isBroaderCredential ? design.outcomes.length > 0 && design.outcomes.every((outcome) => mappedBroaderOutcomes.has(outcome.id)) : design.outcomes.length > 0 && design.outcomes.every((outcome) => mappedOutcomes.has(outcome.id)), detail: isBroaderCredential ? "Map every broader-credential outcome to evidence in one or more selected component microcredentials." : "Map at least one learning block to every course outcome." },
    { id: "accessible", label: "Accessible learning content", passed: Boolean(design.accessibilityStatement) && (isBroaderCredential || materials.every((material) => material.kind === "Watch" ? Boolean(material.transcriptPublished && material.transcript) : Boolean(material.accessibilityChecked))), detail: isBroaderCredential ? "Accessibility remains governed by the already-approved component credentials." : "Confirm accessibility for each block and provide reviewed transcripts for published video or audio." },
    { id: "assessment", label: "Assessment evidence", passed: isBroaderCredential && questionCount === 0 ? true : assessmentConfig ? validateAssessmentForPublication(assessmentConfig, questionCount || 100).valid : questionCount >= 1, detail: isBroaderCredential && questionCount === 0 ? "Assessment evidence is inherited from the approved component credentials. Add a separate capstone only when the broader outcomes require additional evidence." : assessmentConfig ? (validateAssessmentForPublication(assessmentConfig, questionCount || 100).issues[0] ?? "Author at least one scored assessment question.") : "Author at least one scored assessment question." },
    { id: "activities", label: "Authentic activity settings", passed: activities.every((activity) => { if (!activity.required) return true; const mode = String(activity.gradingMode || "facilitator"); const markingEvidence = mode === "rule" ? Boolean(activity.correctAnswer?.trim()) : Boolean(activity.rubric?.trim()); return Boolean(activity.title?.trim() && activity.instructions?.trim() && markingEvidence && Number(activity.passMark) > 0 && Number(activity.attemptsAllowed) > 0 && activity.sectionId && sectionIds.has(activity.sectionId) && ["facilitator", "rule", "ai_auto", "ai_luna", "ai_terra"].includes(mode)); }), detail: "Required activities need a course section, instructions, pass mark, attempt limit and a valid rule answer or marking rubric." },
  ];
  const passed = checks.filter((check) => check.passed).length;
  return { checks, score: Math.round((passed / checks.length) * 100), ready: passed === checks.length };
}
