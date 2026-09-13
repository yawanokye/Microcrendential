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

export type ManualCourseQuestion = {
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

export type ManualCourseDraft = {
  title: string;
  code: string;
  discipline: string;
  description: string;
  design: CourseDesign;
  materials: CourseMaterialRecord[];
  activities: never[];
  assessmentModes: string[];
  assessmentConfig: {
    passMark: number;
    attempts: string;
    questions: ManualCourseQuestion[];
    questionFiles: never[];
  };
  gateRequired: boolean;
  questionLimit: number;
  certificateEnabled: boolean;
};

export type ManualCourseProposal = {
  source: {
    fileName: string;
    fileKey: string;
    mimeType: string;
    wordCount: number;
    conversionNote: string;
  };
  course: ManualCourseDraft;
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

type BuildManualCourseProposalInput = {
  fileName: string;
  fileKey: string;
  mimeType: string;
  readableHtml: string;
  plainText: string;
  conversionNote: string;
};

const observableVerb = /^(analyse|analyze|apply|assess|build|calculate|compare|create|critique|define|demonstrate|describe|design|develop|differentiate|evaluate|explain|identify|implement|interpret|justify|measure|plan|produce|solve|use)\b/i;

const cleanLine = (value: string) => value
  .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "")
  .replace(/\s+/g, " ")
  .trim();

const titleCase = (value: string) => value
  .replace(/[_-]+/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const sentenceList = (text: string) => text
  .split(/(?<=[.!?])\s+|\n+/)
  .map(cleanLine)
  .filter((item) => item.length >= 25 && item.length <= 360);

function findTitle(text: string, fileName: string) {
  const firstUsefulLine = text
    .split(/\n+/)
    .map(cleanLine)
    .find((line) => line.length >= 8 && line.length <= 140 && !/^(table of contents|contents|copyright|page \d+)/i.test(line));
  return (firstUsefulLine || titleCase(fileName.replace(/\.[^.]+$/, ""))).slice(0, 180);
}

function findObjectives(text: string) {
  const matches = sentenceList(text).filter((item) => observableVerb.test(item) || /^(?:to\s+)(?:analyse|analyze|apply|assess|build|compare|create|demonstrate|design|develop|evaluate|explain|identify|interpret|justify|understand|use)\b/i.test(item));
  return [...new Set(matches)].slice(0, 5);
}

function buildOutcomes(objectives: string[]): LearningOutcome[] {
  const defaults = defaultCourseDesign().outcomes.map((item) => item.statement);
  const source = objectives.length >= 2 ? objectives : defaults;
  return source.slice(0, 6).map((objective, index) => {
    const withoutTo = objective.replace(/^to\s+/i, "").replace(/[.!?]+$/, "");
    const statement = observableVerb.test(withoutTo)
      ? `${withoutTo}.`
      : `Explain and apply ${withoutTo.toLowerCase()}.`;
    const skill = /data|evidence|research/i.test(statement)
      ? "Data literacy"
      : /design|create|develop|build/i.test(statement)
        ? "Applied problem-solving"
        : "Conceptual understanding";
    return {
      id: `manual-outcome-${index + 1}`,
      statement: statement.charAt(0).toUpperCase() + statement.slice(1),
      skill,
      assessmentMethod: index === 0 ? "Objective knowledge check" : "Applied assignment or practical evidence",
    };
  });
}

function buildSections(text: string) {
  const headings = text
    .split(/\n+/)
    .map(cleanLine)
    .filter((line) => line.length >= 4 && line.length <= 100 && (/^(module|unit|chapter|section|topic|part)\s+\w+/i.test(line) || /^[A-Z][A-Z\s&:,()-]{5,}$/.test(line)));
  const uniqueHeadings = [...new Set(headings.map((line) => titleCase(line.toLowerCase())))].slice(0, 6);
  const titles = uniqueHeadings.length >= 2
    ? uniqueHeadings
    : ["Orientation and foundations", "Core concepts and guided practice", "Application and assessment"];
  return titles.map((title, index) => ({
    id: `manual-section-${index + 1}`,
    title,
    description: `Learning from the uploaded manual organised around ${title.toLowerCase()}.`,
  }));
}

function splitReadableContent(html: string, text: string, count: number) {
  const headingParts = html
    .split(/(?=<h[1-4][\s>])/i)
    .filter((part) => part.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().length > 80);
  if (headingParts.length >= count) {
    return headingParts.slice(0, count - 1).concat(headingParts.slice(count - 1).join(""));
  }

  const blocks = html.match(/<(?:h[1-6]|p|ul|ol|blockquote|table)(?:\s[^>]*)?>[\s\S]*?<\/(?:h[1-6]|p|ul|ol|blockquote|table)>/gi) ?? [];
  if (blocks.length >= count) {
    const perSection = Math.ceil(blocks.length / count);
    return Array.from({ length: count }, (_, index) => blocks.slice(index * perSection, (index + 1) * perSection).join(""));
  }

  const words = text.split(/\s+/).filter(Boolean);
  const chunkSize = Math.max(350, Math.ceil(words.length / count));
  return Array.from({ length: count }, (_, index) => {
    const end = index === count - 1 ? words.length : (index + 1) * chunkSize;
    return textToReadableHtml(words.slice(index * chunkSize, end).join(" "));
  });
}

function buildMaterials(
  input: BuildManualCourseProposalInput,
  sections: CourseDesign["sections"],
  outcomes: LearningOutcome[],
) {
  const content = splitReadableContent(input.readableHtml, input.plainText, sections.length);
  return sections.map<CourseMaterialRecord>((section, index) => {
    const readableHtml = content[index] || `<h2>${section.title}</h2><p>Review the facilitator manual content related to this section.</p>`;
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
      outcomeIds: [outcomes[index % outcomes.length]?.id, outcomes[(index + 1) % outcomes.length]?.id].filter((id): id is string => Boolean(id)),
      accessibilityChecked: false,
      required: true,
      license: "Rights, attribution and distribution permission require facilitator review",
    };
  });
}

function review(
  id: string,
  group: ManualImportGroup,
  label: string,
  value: string,
  status: ManualImportStatus,
  confidence: number,
  guidance: string,
  sourceExcerpt?: string,
): ManualImportReview {
  return { id, group, label, value, status, confidence, guidance, sourceExcerpt };
}

export function buildManualCourseProposal(input: BuildManualCourseProposalInput): ManualCourseProposal {
  const cleanText = input.plainText.replace(/\r/g, "").trim();
  const words = cleanText.split(/\s+/).filter(Boolean);
  const sentences = sentenceList(cleanText);
  const title = findTitle(cleanText, input.fileName);
  const extractedObjectives = findObjectives(cleanText);
  const objectives = extractedObjectives.length >= 2
    ? extractedObjectives
    : [`Build a practical understanding of ${title.toLowerCase()}.`, `Apply the manual's guidance in an authentic professional or community context.`];
  const outcomes = buildOutcomes(objectives);
  const sections = buildSections(cleanText);
  const descriptionText = sentences.slice(0, 4).join(" ");
  const description = (descriptionText.length >= 80
    ? descriptionText
    : `This microcredential uses the uploaded facilitator manual to build practical understanding and assess authentic application of ${title}.`).slice(0, 1200);
  const design: CourseDesign = {
    ...defaultCourseDesign(),
    deliveryPattern: "asynchronous",
    expectedHours: Math.min(120, Math.max(4, Math.ceil(words.length / 750))),
    enrolmentMode: "open",
    priceGhs: 0,
    certificateFeeGhs: 0,
    creditValue: 0,
    objectives,
    outcomes,
    skills: [...new Set(outcomes.map((item) => item.skill))],
    sections,
  };
  const materials = buildMaterials(input, sections, outcomes);
  const questions: ManualCourseQuestion[] = outcomes.slice(0, 3).map((outcome, index) => ({
    id: `manual-question-${index + 1}`,
    type: index === 0 ? "Short answer" : "Scenario response",
    prompt: index === 0
      ? `Explain the central concept addressed by this outcome: ${outcome.statement}`
      : `Apply this outcome to a realistic professional or community situation: ${outcome.statement}`,
    options: [],
    points: index === 0 ? 5 : 10,
    scheme: "Award marks for accurate use of the manual, a justified application, and acknowledgement of relevant limitations.",
    feedbackCorrect: "The response demonstrates the expected outcome.",
    feedbackIncorrect: "Revisit the linked manual section and strengthen the evidence used in your response.",
    learnerAdvice: "Refer directly to the course manual and explain how the guidance supports your answer.",
    outcomeIds: [outcome.id],
  }));
  const course: ManualCourseDraft = {
    title,
    code: `UCC-MC-${String(Date.now()).slice(-6)}`,
    discipline: "Interdisciplinary",
    description,
    design,
    materials,
    activities: [],
    assessmentModes: ["Objective quiz", "Applied assignment"],
    assessmentConfig: { passMark: 60, attempts: "2 attempts", questions, questionFiles: [] },
    gateRequired: true,
    questionLimit: Math.max(10, questions.length),
    certificateEnabled: true,
  };

  const titleEvidence = cleanText.split(/\n+/).map(cleanLine).find((line) => line === title);
  const reviews: ManualImportReview[] = [
    review("title", "blueprint", "Course title", title, titleEvidence ? "confirmed" : "suggested", titleEvidence ? 0.92 : 0.65, "Confirm that the title is concise, learner-facing and accurately represents the manual.", titleEvidence),
    review("code", "blueprint", "Course code", course.code, "suggested", 0.45, "Replace the generated code if your institution uses an approved coding convention."),
    review("discipline", "blueprint", "Discipline", course.discipline, "needs_review", 0.4, "Choose the most accurate academic or professional discipline before submission."),
    review("description", "blueprint", "Course description", description, descriptionText.length >= 80 ? "confirmed" : "suggested", descriptionText.length >= 80 ? 0.82 : 0.58, "Edit this into a clear learner-facing summary.", descriptionText || undefined),
    review("delivery", "blueprint", "Delivery pattern", design.deliveryPattern, "suggested", 0.5, "Confirm whether delivery is asynchronous, synchronous or blended."),
    review("workload", "blueprint", "Expected workload", `${design.expectedHours} hours`, "suggested", 0.55, "Check the reading, activity and assessment workload against the credit or professional-development model."),
    review("access", "blueprint", "Enrolment and fees", "Open self-enrolment · free course · free certificate", "suggested", 0.7, "The platform defaults to free self-enrolment. Add fees only where an approved commercial arrangement applies."),
    review("audience", "blueprint", "Intended audience", design.intendedAudience, "needs_review", 0.35, "State precisely who will benefit from this course."),
    review("prerequisites", "blueprint", "Prerequisites", design.prerequisites, "needs_review", 0.35, "Confirm entry knowledge, technology and access requirements."),
    review("objectives", "outcomes", "Course objectives", objectives.join(" | "), extractedObjectives.length >= 2 ? "confirmed" : "suggested", extractedObjectives.length >= 2 ? 0.8 : 0.55, "Verify that each objective describes the course purpose.", extractedObjectives[0]),
    review("outcomes", "outcomes", "Measurable outcomes", outcomes.map((item) => item.statement).join(" | "), extractedObjectives.length >= 2 ? "suggested" : "needs_review", extractedObjectives.length >= 2 ? 0.72 : 0.48, "Use observable verbs and confirm the evidence that proves each outcome."),
    review("skills", "outcomes", "Skills", design.skills.join(", "), "suggested", 0.62, "Replace broad tags with the capabilities learners will demonstrate."),
    review("sections", "outcomes", "Course sections", sections.map((item) => item.title).join(" | "), sections.some((item) => /module|unit|chapter|section/i.test(item.title)) ? "confirmed" : "suggested", 0.7, "Check the sequence and rename sections for a clear learner journey."),
    review("source", "content", "Original source document", input.fileName, "confirmed", 1, "The uploaded file remains attached as the authoritative source."),
    review("blocks", "content", "Readable learning blocks", `${materials.length} section-by-section reading blocks`, "suggested", 0.75, "Review headings, tables, lists and reading order in the learner preview."),
    review("accessibility", "content", "Accessibility confirmation", "Not yet confirmed", "needs_review", 0.2, "Check every block for reading order, headings, image descriptions, tables and keyboard access."),
    review("rights", "content", "Copyright and licence", "Not supplied", "missing", 0, "Record ownership, licence, attribution and permission to distribute this manual."),
    review("assessment", "assessment", "Assessment approach", course.assessmentModes.join(" and "), "suggested", 0.58, "Confirm that the selected evidence directly measures each outcome."),
    review("questions", "assessment", "Draft assessment questions", `${questions.length} editable questions`, "suggested", 0.5, "Replace or refine generated prompts and add authoritative marking guidance."),
    review("credential", "assessment", "Certificate rule", "UCC digital certificate after all required evidence is complete", "needs_review", 0.45, "Academic approval and authorised signatories are still required before certificates can be issued."),
  ];

  const statusCount = (status: ManualImportStatus) => reviews.filter((item) => item.status === status).length;
  const confirmed = statusCount("confirmed");
  const suggested = statusCount("suggested");
  const needsReview = statusCount("needs_review");
  const missing = statusCount("missing");
  const coverageScore = Math.round(((confirmed + suggested * 0.75 + needsReview * 0.35) / reviews.length) * 100);

  return {
    source: {
      fileName: input.fileName,
      fileKey: input.fileKey,
      mimeType: input.mimeType,
      wordCount: words.length,
      conversionNote: input.conversionNote,
    },
    course,
    reviews,
    warnings: [
      "Confirm the extracted title, objectives, outcomes, sequencing and assessment alignment before saving.",
      "Review the converted HTML against the original document and correct lost headings, tables, lists or images.",
      "Record copyright, licence, attribution and distribution permission for the uploaded manual.",
      "Complete the accessibility review; imported blocks intentionally remain unconfirmed.",
      "Automatic import creates an editable draft only. Academic approval is still required before publication.",
    ],
    coverageScore,
    counts: {
      outcomes: outcomes.length,
      sections: sections.length,
      learningBlocks: materials.length,
      questions: questions.length,
      confirmed,
      suggested,
      needsReview,
      missing,
    },
  };
}
