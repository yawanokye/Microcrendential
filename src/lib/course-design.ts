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

export type CourseDesign = {
  category: "credit" | "professional" | "rpl";
  deliveryPattern: "asynchronous" | "synchronous" | "blended";
  level: "foundation" | "applied" | "advanced";
  language: string;
  expectedHours: number;
  enrolmentMode: "open" | "application" | "invitation";
  priceGhs: number;
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
};

export const defaultCourseDesign = (): CourseDesign => ({
  category: "professional",
  deliveryPattern: "blended",
  level: "applied",
  language: "English",
  expectedHours: 24,
  enrolmentMode: "open",
  priceGhs: 0,
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
  const enrolmentModes = new Set<CourseDesign["enrolmentMode"]>(["open", "application", "invitation"]);
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
  return {
    category: categories.has(input.category as CourseDesign["category"]) ? input.category as CourseDesign["category"] : fallback.category,
    deliveryPattern: deliveries.has(input.deliveryPattern as CourseDesign["deliveryPattern"]) ? input.deliveryPattern as CourseDesign["deliveryPattern"] : fallback.deliveryPattern,
    level: levels.has(input.level as CourseDesign["level"]) ? input.level as CourseDesign["level"] : fallback.level,
    language: String(input.language || fallback.language).trim().slice(0, 80),
    expectedHours,
    enrolmentMode: enrolmentModes.has(input.enrolmentMode as CourseDesign["enrolmentMode"]) ? input.enrolmentMode as CourseDesign["enrolmentMode"] : fallback.enrolmentMode,
    priceGhs,
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
}) {
  const { title = "", description = "", design, materials, questionCount } = input;
  const sectionIds = new Set(design.sections.map((section) => section.id));
  const mappedOutcomes = new Set(materials.flatMap((material) => material.outcomeIds ?? []));
  const checks: CourseQualityCheck[] = [
    { id: "identity", label: "Clear course identity", passed: title.trim().length >= 8 && description.trim().length >= 80, detail: "Use a specific title and a learner-facing description of at least 80 characters." },
    { id: "audience", label: "Audience and prerequisites", passed: design.intendedAudience.length >= 20 && design.prerequisites.length >= 10, detail: "State who the course serves and what learners need before starting." },
    { id: "objectives", label: "Course objectives", passed: design.objectives.length >= 2, detail: "Provide at least two clear design objectives." },
    { id: "outcomes", label: "Measurable outcomes", passed: design.outcomes.length >= 2 && design.outcomes.every((outcome) => outcome.assessmentMethod && outcome.skill), detail: "Provide at least two outcomes, each with a skill and assessment method." },
    { id: "structure", label: "Structured curriculum", passed: design.sections.length >= 1 && materials.length >= 2 && materials.every((material) => material.sectionId && sectionIds.has(material.sectionId)), detail: "Add at least two learning blocks and place every block in a section." },
    { id: "alignment", label: "Outcome alignment", passed: design.outcomes.length > 0 && design.outcomes.every((outcome) => mappedOutcomes.has(outcome.id)), detail: "Map at least one learning block to every course outcome." },
    { id: "accessible", label: "Accessible learning content", passed: Boolean(design.accessibilityStatement) && materials.every((material) => material.kind === "Watch" ? Boolean(material.transcriptPublished && material.transcript) : Boolean(material.accessibilityChecked)), detail: "Confirm accessibility for each block and provide reviewed transcripts for published video or audio." },
    { id: "assessment", label: "Assessment evidence", passed: questionCount >= 1, detail: "Author at least one scored assessment question." },
  ];
  const passed = checks.filter((check) => check.passed).length;
  return { checks, score: Math.round((passed / checks.length) * 100), ready: passed === checks.length };
}
