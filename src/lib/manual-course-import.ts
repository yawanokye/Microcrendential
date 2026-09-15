import { defaultCourseDesign, type CourseDesign, type CourseMaterialRecord, type LearningOutcome } from "@/lib/course-design";
import { textToReadableHtml } from "@/lib/document-content";

export type ManualImportGroup = "blueprint" | "outcomes" | "content" | "assessment";
export type ManualImportStatus = "confirmed" | "suggested" | "needs_review" | "missing";

export type ManualImportReview = {
  id: string;
  group: ManualImportGroup;
  label: string;
  value: string;
  status: ManualImportStatus;
  confidence: number;
  guidance: string;
  sourceExcerpt?: string;
};

type ManualQuestion = {
  id: string;
  type: "Short answer" | "Scenario response";
  prompt: string;
  options: string[];
  points: number;
  scheme: string;
  feedbackCorrect: string;
  feedbackIncorrect: string;
  learnerAdvice: string;
  outcomeIds: string[];
};

export type ManualCourseProposal = {
  source: { fileName: string; fileKey: string; mimeType: string; wordCount: number; conversionNote: string };
  course: {
    title: string;
    code: string;
    discipline: string;
    description: string;
    design: CourseDesign;
    materials: CourseMaterialRecord[];
    activities: never[];
    assessmentModes: string[];
    assessmentConfig: { passMark: number; attempts: string; questions: ManualQuestion[]; questionFiles: never[] };
    gateRequired: boolean;
    questionLimit: number;
    certificateEnabled: boolean;
  };
  reviews: ManualImportReview[];
  warnings: string[];
  coverageScore: number;
  counts: {
    outcomes: number;
    sections: number;
    learningBlocks: number;
    questions: number;
    confirmed: number;
    suggested: number;
    needsReview: number;
    missing: number;
  };
};

type BuildInput = {
  fileName: string;
  fileKey: string;
  mimeType: string;
  readableHtml: string;
  plainText: string;
  conversionNote: string;
};

const clean = (value: string) => value.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").replace(/\s+/g, " ").trim();
const sentences = (value: string) => value.split(/(?<=[.!?])\s+|\n+/).map(clean).filter((item) => item.length >= 25 && item.length <= 360);
const observable = /^(analyse|analyze|apply|assess|build|calculate|compare|create|define|demonstrate|describe|design|develop|evaluate|explain|identify|implement|interpret|justify|measure|plan|produce|solve|use)\b/i;

function titleFrom(text: string, fileName: string) {
  const line = text.split(/\n+/).map(clean).find((item) => item.length >= 8 && item.length <= 140 && !/^(contents|table of contents|copyright|page \d+)/i.test(item));
  return (line || fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ")).slice(0, 180);
}

function objectivesFrom(text: string, title: string) {
  const found = [...new Set(sentences(text).filter((item) => observable.test(item) || /^to\s+(?:analyse|analyze|apply|build|create|design|develop|evaluate|explain|identify|understand|use)\b/i.test(item)))].slice(0, 5);
  return found.length >= 2 ? found : [
    `Build a practical understanding of ${title.toLowerCase()}.`,
    "Apply the manual's guidance in an authentic professional or community context.",
  ];
}

function outcomesFrom(objectives: string[]): LearningOutcome[] {
  return objectives.slice(0, 6).map((objective, index) => {
    const base = objective.replace(/^to\s+/i, "").replace(/[.!?]+$/, "");
    const statement = observable.test(base) ? `${base}.` : `Explain and apply ${base.toLowerCase()}.`;
    return {
      id: `manual-outcome-${index + 1}`,
      statement: statement.charAt(0).toUpperCase() + statement.slice(1),
      skill: /data|evidence|research/i.test(statement) ? "Data literacy" : /design|create|develop|build/i.test(statement) ? "Applied problem-solving" : "Conceptual understanding",
      assessmentMethod: index === 0 ? "Objective knowledge check" : "Applied assignment or practical evidence",
    };
  });
}

function sectionsFrom(text: string) {
  const headings = [...new Set(text.split(/\n+/).map(clean).filter((line) => line.length >= 4 && line.length <= 100 && (/^(module|unit|chapter|section|topic|part)\s+\w+/i.test(line) || /^[A-Z][A-Z\s&:,()-]{5,}$/.test(line))))].slice(0, 6);
  const titles = headings.length >= 2 ? headings : ["Orientation and foundations", "Core concepts and guided practice", "Application and assessment"];
  return titles.map((title, index) => ({ id: `manual-section-${index + 1}`, title, description: `Learning from the uploaded manual organised around ${title.toLowerCase()}.` }));
}

function contentBlocks(input: BuildInput, count: number) {
  const blocks = input.readableHtml.match(/<(?:h[1-6]|p|ul|ol|blockquote|table)(?:\s[^>]*)?>[\s\S]*?<\/(?:h[1-6]|p|ul|ol|blockquote|table)>/gi) ?? [];
  if (blocks.length >= count) {
    const size = Math.ceil(blocks.length / count);
    return Array.from({ length: count }, (_, index) => blocks.slice(index * size, (index + 1) * size).join(""));
  }
  const words = input.plainText.split(/\s+/).filter(Boolean);
  const size = Math.max(350, Math.ceil(words.length / count));
  return Array.from({ length: count }, (_, index) => textToReadableHtml(words.slice(index * size, index === count - 1 ? words.length : (index + 1) * size).join(" ")));
}

const makeReview = (id: string, group: ManualImportGroup, label: string, value: string, status: ManualImportStatus, confidence: number, guidance: string, sourceExcerpt?: string): ManualImportReview => ({ id, group, label, value, status, confidence, guidance, sourceExcerpt });

export function buildManualCourseProposal(input: BuildInput): ManualCourseProposal {
  const text = input.plainText.replace(/\r/g, "").trim();
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const title = titleFrom(text, input.fileName);
  const objectives = objectivesFrom(text, title);
  const outcomes = outcomesFrom(objectives);
  const sections = sectionsFrom(text);
  const descriptionSource = sentences(text).slice(0, 4).join(" ");
  const description = (descriptionSource.length >= 80 ? descriptionSource : `This microcredential uses the uploaded facilitator manual to build practical understanding and assess authentic application of ${title}.`).slice(0, 1200);
  const design: CourseDesign = {
    ...defaultCourseDesign(),
    deliveryPattern: "asynchronous",
    expectedHours: Math.min(120, Math.max(4, Math.ceil(wordCount / 750))),
    enrolmentMode: "open",
    priceGhs: 0,
    certificateFeeGhs: 0,
    creditValue: 0,
    objectives,
    outcomes,
    skills: [...new Set(outcomes.map((outcome) => outcome.skill))],
    sections,
  };
  const blocks = contentBlocks(input, sections.length);
  const materials: CourseMaterialRecord[] = sections.map((section, index) => {
    const readableHtml = blocks[index] || `<h2>${section.title}</h2><p>Review this section of the uploaded manual.</p>`;
    const plainText = readableHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return {
      id: `manual-material-${index + 1}`,
      title: index === 0 ? `Start here: ${section.title}` : section.title,
      kind: "Read",
      source: "Uploaded facilitator manual",
      fileKey: input.fileKey,
      fileName: input.fileName,
      mimeType: input.mimeType,
      readableHtml,
      plainText,
      sectionId: section.id,
      sectionTitle: section.title,
      unitTitle: `Learning unit ${index + 1}`,
      estimatedMinutes: Math.max(5, Math.ceil(plainText.split(/\s+/).filter(Boolean).length / 180)),
      outcomeIds: [outcomes[index % outcomes.length]?.id].filter((id): id is string => Boolean(id)),
      accessibilityChecked: false,
      required: true,
      license: "Rights and attribution require facilitator review",
    };
  });
  const questions: ManualQuestion[] = outcomes.slice(0, 3).map((outcome, index) => ({
    id: `manual-question-${index + 1}`,
    type: index === 0 ? "Short answer" : "Scenario response",
    prompt: index === 0 ? `Explain: ${outcome.statement}` : `Apply this outcome to a realistic situation: ${outcome.statement}`,
    options: [],
    points: index === 0 ? 5 : 10,
    scheme: "Award marks for accurate use of the manual, justified application and relevant limitations.",
    feedbackCorrect: "The response demonstrates the expected outcome.",
    feedbackIncorrect: "Revisit the linked manual section and strengthen the evidence used.",
    learnerAdvice: "Refer directly to the manual and explain how it supports your answer.",
    outcomeIds: [outcome.id],
  }));
  const course = {
    title,
    code: `UCC-MC-${String(Date.now()).slice(-6)}`,
    discipline: "Interdisciplinary",
    description,
    design,
    materials,
    activities: [] as never[],
    assessmentModes: ["Objective quiz", "Applied assignment"],
    assessmentConfig: { passMark: 60, attempts: "2 attempts", questions, questionFiles: [] as never[] },
    gateRequired: true,
    questionLimit: Math.max(10, questions.length),
    certificateEnabled: true,
  };
  const reviews = [
    makeReview("title", "blueprint", "Course title", title, "confirmed", 0.9, "Confirm that the title accurately represents the manual.", title),
    makeReview("code", "blueprint", "Course code", course.code, "suggested", 0.45, "Replace this code if the institution uses an approved convention."),
    makeReview("discipline", "blueprint", "Discipline", course.discipline, "needs_review", 0.4, "Choose the most accurate discipline."),
    makeReview("description", "blueprint", "Course description", description, "suggested", 0.75, "Edit this into a concise learner-facing summary.", descriptionSource || undefined),
    makeReview("access", "blueprint", "Enrolment and fees", "Open self-enrolment · free course · free certificate", "suggested", 0.7, "Add fees only where an approved arrangement applies."),
    makeReview("objectives", "outcomes", "Objectives", objectives.join(" | "), "suggested", 0.7, "Verify that each objective describes the course purpose."),
    makeReview("outcomes", "outcomes", "Measurable outcomes", outcomes.map((outcome) => outcome.statement).join(" | "), "needs_review", 0.6, "Use observable verbs and verify the evidence for every outcome."),
    makeReview("sections", "outcomes", "Course sections", sections.map((section) => section.title).join(" | "), "suggested", 0.7, "Confirm the sequence of the learner journey."),
    makeReview("source", "content", "Original manual", input.fileName, "confirmed", 1, "The uploaded document remains attached as the source."),
    makeReview("blocks", "content", "Readable learning blocks", `${materials.length} section-by-section blocks`, "suggested", 0.75, "Review rich formatting and reading order in learner preview."),
    makeReview("accessibility", "content", "Accessibility", "Not yet confirmed", "needs_review", 0.2, "Check headings, tables, images, reading order and keyboard access."),
    makeReview("rights", "content", "Copyright and licence", "Not supplied", "missing", 0, "Record ownership, attribution and permission to distribute."),
    makeReview("assessment", "assessment", "Assessment", course.assessmentModes.join(" and "), "suggested", 0.55, "Verify that assessment evidence measures each outcome."),
    makeReview("questions", "assessment", "Draft questions", `${questions.length} editable questions`, "needs_review", 0.45, "Review prompts, answers and marking guidance."),
    makeReview("credential", "assessment", "Certificate", "Certificate after all required evidence is complete", "needs_review", 0.45, "Academic approval and authorised signatories remain required."),
  ] satisfies ManualImportReview[];
  const confirmed = reviews.filter((item) => item.status === "confirmed").length;
  const suggested = reviews.filter((item) => item.status === "suggested").length;
  const needsReview = reviews.filter((item) => item.status === "needs_review").length;
  const missing = reviews.filter((item) => item.status === "missing").length;
  const coverageScore = Math.round(((confirmed + suggested * 0.75 + needsReview * 0.35) / reviews.length) * 100);
  return {
    source: { fileName: input.fileName, fileKey: input.fileKey, mimeType: input.mimeType, wordCount, conversionNote: input.conversionNote },
    course,
    reviews,
    warnings: [
      "Verify every extracted field before saving or submitting the course.",
      "Review the original manual beside the converted learner lessons.",
      "Confirm copyright, attribution, accessibility and assessment accuracy.",
      "Import creates an unsaved draft; academic approval is still required.",
    ],
    coverageScore,
    counts: { outcomes: outcomes.length, sections: sections.length, learningBlocks: materials.length, questions: questions.length, confirmed, suggested, needsReview, missing },
  };
}
