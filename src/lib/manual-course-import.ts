import type { CourseDesign, CourseMaterialRecord } from "@/lib/course-design";
import { plainTextFromHtml, textToReadableHtml } from "@/lib/document-content";

export type ManualImportStatus = "confirmed" | "suggested" | "needs_review" | "missing";
export type ManualImportGroup = "blueprint" | "outcomes" | "content" | "assessment";

export type ManualFieldReview = {
  id: string;
  group: ManualImportGroup;
  label: string;
  value: string;
  status: ManualImportStatus;
  confidence: number;
  sourceExcerpt: string;
  guidance: string;
};

export type ManualAssessmentQuestion = {
  id: string;
  type: string;
  prompt: string;
  options: string[];
  correctAnswer: string;
  points: number;
  scheme: string;
  feedbackCorrect: string;
  feedbackIncorrect: string;
  learnerAdvice: string;
  outcomeIds: string[];
};

export type ManualCourseProposal = {
  source: {
    fileName: string;
    fileKey: string;
    mimeType: string;
    wordCount: number;
    conversionNote: string;
  };
  course: {
    code: string;
    title: string;
    description: string;
    discipline: string;
  };
  design: CourseDesign;
  materials: CourseMaterialRecord[];
  assessmentModes: string[];
  assessmentConfig: {
    passMark: number;
    attempts: string;
    questions: ManualAssessmentQuestion[];
  };
  gateRequired: boolean;
  questionLimit: number;
  certificateEnabled: boolean;
  reviews: ManualFieldReview[];
  warnings: string[];
  coverageScore: number;
  counts: {
    objectives: number;
    outcomes: number;
    skills: number;
    sections: number;
    learningBlocks: number;
    questions: number;
    confirmed: number;
    suggested: number;
    needsReview: number;
    missing: number;
  };
};

type SourceSection = { title: string; body: string; excerpt: string };
type LocatedValue = { value: string; excerpt: string; found: boolean };

const GENERIC_HEADINGS = new Set([
  "contents", "table of contents", "introduction", "overview", "course overview", "course description",
  "course objectives", "objectives", "learning objectives", "learning outcomes", "course outcomes", "outcomes",
  "target audience", "intended audience", "audience", "prerequisites", "entry requirements", "assessment",
  "assessment methods", "references", "bibliography", "appendix", "appendices",
]);

const SKILL_LIBRARY = [
  "Critical thinking", "Digital literacy", "Evidence-based decision-making", "Applied problem-solving",
  "Communication", "Collaboration", "Data literacy", "Research and inquiry", "Leadership",
  "Ethical decision-making", "Project management", "Professional practice", "Creativity", "Entrepreneurship",
];

const observableVerbs = /^(analyse|analyze|apply|assess|build|calculate|classify|compare|create|critique|defend|demonstrate|design|develop|differentiate|evaluate|examine|explain|formulate|identify|implement|interpret|justify|measure|perform|plan|prepare|produce|recommend|solve|use|validate|write)\b/i;

const cleanText = (value: string) => value
  .replace(/\r\n?/g, "\n")
  .replace(/[ \t]+/g, " ")
  .replace(/\n[ \t]+/g, "\n")
  .replace(/\n{3,}/g, "\n\n")
  .trim();

const cleanLine = (value: string) => value
  .replace(/^\s*(?:[-*•▪◦]|\d+[.)]|[a-z][.)])\s*/i, "")
  .replace(/\s+/g, " ")
  .trim();

const stripHtml = (value: string) => plainTextFromHtml(value).replace(/\s+/g, " ").trim();

const excerpt = (value: string, maximum = 240) => {
  const cleaned = cleanText(value).replace(/\n+/g, " ");
  return cleaned.length <= maximum ? cleaned : `${cleaned.slice(0, maximum - 1).trim()}…`;
};

const sentence = (value: string, maximum = 600) => {
  const cleaned = cleanLine(value).slice(0, maximum);
  if (!cleaned) return "";
  return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
};

const titleFromFileName = (fileName: string) => fileName
  .replace(/\.[^.]+$/, "")
  .replace(/[_-]+/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .replace(/\b\w/g, (character) => character.toUpperCase())
  .slice(0, 180);

function sourceLines(text: string) {
  return cleanText(text).split("\n").map((line) => line.trim()).filter(Boolean);
}

function locateLabel(lines: string[], labels: RegExp[], maximumLines = 4): LocatedValue {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    for (const label of labels) {
      const inline = line.match(label);
      if (!inline) continue;
      const inlineValue = cleanLine(inline[1] ?? "");
      const following: string[] = [];
      for (let offset = 1; offset <= maximumLines && index + offset < lines.length; offset += 1) {
        const candidate = lines[index + offset];
        if (/^(?:chapter|module|unit|section|topic)\s+\d+/i.test(candidate)) break;
        if (/^[A-Z][A-Z\s/&-]{4,}:?$/.test(candidate) && following.length) break;
        if (candidate.length >= 4) following.push(cleanLine(candidate));
      }
      const value = inlineValue || following.join(" ");
      if (value) return { value: value.slice(0, 2000), excerpt: excerpt([line, ...following].join(" ")), found: true };
    }
  }
  return { value: "", excerpt: "", found: false };
}

function listAfterHeading(lines: string[], headings: RegExp[], maximum = 12) {
  for (let index = 0; index < lines.length; index += 1) {
    if (!headings.some((pattern) => pattern.test(lines[index]))) continue;
    const items: string[] = [];
    for (let offset = 1; index + offset < lines.length && items.length < maximum; offset += 1) {
      const raw = lines[index + offset];
      if (offset > 1 && (/^[A-Z][A-Z\s/&-]{4,}:?$/.test(raw) || /^(?:chapter|module|unit|section|topic)\s+\d+/i.test(raw))) break;
      const item = cleanLine(raw);
      if (item.length >= 8 && item.length <= 600) items.push(sentence(item));
      if (items.length >= 2 && offset >= 8) break;
    }
    if (items.length) return { items, excerpt: excerpt([lines[index], ...items].join(" ")), found: true };
  }
  return { items: [] as string[], excerpt: "", found: false };
}

function htmlHeadingSections(html: string): SourceSection[] {
  const matches = Array.from(html.matchAll(/<h[1-4]>([\s\S]*?)<\/h[1-4]>/gi));
  const output: SourceSection[] = [];
  for (let index = 0; index < matches.length; index += 1) {
    const title = cleanLine(stripHtml(matches[index][1]));
    if (!title || GENERIC_HEADINGS.has(title.toLowerCase())) continue;
    const start = (matches[index].index ?? 0) + matches[index][0].length;
    const end = matches[index + 1]?.index ?? html.length;
    const body = cleanText(plainTextFromHtml(html.slice(start, end)));
    if (body.length < 60) continue;
    output.push({ title: title.slice(0, 180), body: body.slice(0, 18_000), excerpt: excerpt(`${title}: ${body}`) });
  }
  return output.slice(0, 10);
}

function numberedSections(lines: string[]): SourceSection[] {
  const starts: { index: number; title: string }[] = [];
  lines.forEach((line, index) => {
    const match = line.match(/^(?:(?:chapter|module|unit|section|topic)\s+\d+(?:\.\d+)*\s*[:.\-–]?\s*)(.{3,180})$/i);
    if (match) starts.push({ index, title: cleanLine(match[1]) });
  });
  return starts.slice(0, 10).map((item, index) => {
    const body = cleanText(lines.slice(item.index + 1, starts[index + 1]?.index ?? lines.length).join("\n")).slice(0, 18_000);
    return { title: item.title, body, excerpt: excerpt(`${item.title}: ${body}`) };
  }).filter((item) => item.body.length >= 60);
}

function fallbackSections(text: string, title: string): SourceSection[] {
  const paragraphs = cleanText(text).split(/\n{2,}/).map(cleanLine).filter((item) => item.length >= 80);
  const midpoint = Math.max(1, Math.ceil(paragraphs.length / 2));
  const first = paragraphs.slice(0, midpoint).join("\n\n") || text.slice(0, Math.ceil(text.length / 2));
  const second = paragraphs.slice(midpoint).join("\n\n") || text.slice(Math.ceil(text.length / 2));
  return [
    { title: `${title}: foundations`, body: first.slice(0, 18_000), excerpt: excerpt(first) },
    { title: `${title}: application and review`, body: second.slice(0, 18_000), excerpt: excerpt(second) },
  ].filter((item) => item.body.length >= 60);
}

function chooseTitle(lines: string[], fileName: string): LocatedValue {
  const labelled = locateLabel(lines, [/^(?:course|programme|module)\s*title\s*[:\-–]\s*(.+)$/i], 1);
  if (labelled.found) return labelled;
  const candidate = lines.find((line) => line.length >= 8 && line.length <= 180 && !/^(table of contents|contents|course manual|learning manual)$/i.test(line));
  return candidate
    ? { value: cleanLine(candidate), excerpt: candidate, found: true }
    : { value: titleFromFileName(fileName), excerpt: fileName, found: false };
}

function classifyDiscipline(text: string) {
  const options: Array<[string, string[]]> = [
    ["Education", ["teaching", "pedagogy", "curriculum", "learner", "school", "education"]],
    ["Humanities & Social Sciences", ["society", "community", "history", "language", "governance", "policy", "social"]],
    ["Business & Management", ["business", "management", "finance", "marketing", "accounting", "entrepreneur"]],
    ["Science", ["biology", "chemistry", "physics", "laboratory", "science", "experiment"]],
    ["Technology & Engineering", ["engineering", "software", "computer", "technology", "programming", "circuit"]],
    ["Health Sciences", ["health", "clinical", "patient", "nursing", "medical", "medicine"]],
    ["Agriculture & Natural Resources", ["agriculture", "crop", "soil", "farm", "forestry", "fisher"]],
    ["Creative Arts & Design", ["design", "art", "music", "theatre", "creative", "visual"]],
  ];
  const lower = text.toLowerCase();
  const ranked = options.map(([name, terms]) => ({ name, score: terms.reduce((sum, term) => sum + (lower.match(new RegExp(`\\b${term}`, "g"))?.length ?? 0), 0) })).sort((a, b) => b.score - a.score);
  return ranked[0]?.score ? ranked[0].name : "Interdisciplinary";
}

function inferSkills(text: string, title: string) {
  const lower = `${title} ${text}`.toLowerCase();
  const direct = SKILL_LIBRARY.filter((skill) => lower.includes(skill.toLowerCase()));
  const inferred = [
    ...(lower.match(/data|statistics|analytics/) ? ["Data literacy", "Evidence-based decision-making"] : []),
    ...(lower.match(/digital|computer|technology|online/) ? ["Digital literacy"] : []),
    ...(lower.match(/research|inquiry|investigat/) ? ["Research and inquiry"] : []),
    ...(lower.match(/communicat|present|report|write/) ? ["Communication"] : []),
    ...(lower.match(/team|collaborat|group/) ? ["Collaboration"] : []),
    ...(lower.match(/ethic|responsib|privacy|integrity/) ? ["Ethical decision-making"] : []),
  ];
  return Array.from(new Set([...direct, ...inferred, "Critical thinking", "Applied problem-solving"])).slice(0, 10);
}

function inferAssessmentModes(text: string) {
  const lower = text.toLowerCase();
  const candidates: Array<[RegExp, string]> = [
    [/\bquiz|multiple choice|true or false\b/, "Objective quiz"],
    [/\bassignment|coursework|exercise\b/, "Applied assignment"],
    [/\bpractical|laboratory|demonstrat\b/, "Practical evidence"],
    [/\bpresentation|seminar\b/, "Presentation"],
    [/\bportfolio\b/, "Portfolio"],
    [/\boral|viva|defen[cs]e\b/, "Oral assessment"],
    [/\breflect|journal\b/, "Reflective evidence"],
    [/\bproject|capstone\b/, "Project or capstone"],
  ];
  const found = candidates.filter(([pattern]) => pattern.test(lower)).map(([, mode]) => mode);
  return found.length ? found.slice(0, 8) : ["Applied assignment", "Objective quiz"];
}

function outcomeSkill(statement: string) {
  const lower = statement.toLowerCase();
  if (/data|statistic|visuali[sz]/.test(lower)) return "Data literacy";
  if (/communicat|present|write|report/.test(lower)) return "Professional communication";
  if (/ethic|responsib|privacy|justify|defend/.test(lower)) return "Ethical decision-making";
  if (/research|investigat|inquiry/.test(lower)) return "Research and inquiry";
  if (/apply|create|design|develop|perform|use/.test(lower)) return "Applied problem-solving";
  return "Conceptual understanding";
}

function outcomeAssessment(statement: string) {
  const lower = statement.toLowerCase();
  if (/demonstrat|perform|practical|measure/.test(lower)) return "Observed practical assessment";
  if (/create|design|develop|produce|apply/.test(lower)) return "Applied assignment or practical evidence";
  if (/communicat|present/.test(lower)) return "Presentation or demonstration";
  if (/defend|justify/.test(lower)) return "Oral assessment";
  if (/evaluate|analyse|analyze|critique|compare/.test(lower)) return "Case analysis";
  return "Objective knowledge check";
}

function makeObservable(value: string, index: number) {
  const cleaned = sentence(value.replace(/^to\s+/i, ""));
  if (observableVerbs.test(cleaned)) return cleaned[0].toUpperCase() + cleaned.slice(1);
  return index === 0
    ? `Explain the key concepts, principles and terminology presented in ${cleaned.replace(/[.]$/, "").toLowerCase()}.`
    : `Apply the course concepts to complete an authentic task using evidence from the learning manual.`;
}

function keywordSet(value: string) {
  return new Set(value.toLowerCase().match(/[a-z]{4,}/g)?.filter((word) => !["that", "with", "from", "this", "course", "learner", "using", "will", "have"].includes(word)) ?? []);
}

function mapOutcomes(body: string, outcomes: CourseDesign["outcomes"], fallbackIndex: number) {
  const source = keywordSet(body);
  const matches = outcomes.filter((outcome) => Array.from(keywordSet(outcome.statement)).some((word) => source.has(word))).map((outcome) => outcome.id);
  return matches.length ? matches.slice(0, 4) : outcomes[fallbackIndex % outcomes.length]?.id ? [outcomes[fallbackIndex % outcomes.length].id] : [];
}

function questionCandidates(lines: string[]) {
  return Array.from(new Set(lines
    .map(cleanLine)
    .filter((line) => line.length >= 15 && line.length <= 360 && /\?$/.test(line))))
    .slice(0, 8);
}

function statusWeight(status: ManualImportStatus) {
  if (status === "confirmed") return 1;
  if (status === "suggested") return 0.72;
  if (status === "needs_review") return 0.42;
  return 0;
}

export function buildManualCourseProposal(input: {
  fileName: string;
  fileKey: string;
  mimeType: string;
  readableHtml: string;
  plainText: string;
  conversionNote: string;
}): ManualCourseProposal {
  const text = cleanText(input.plainText);
  const lines = sourceLines(text);
  const titleLocated = chooseTitle(lines, input.fileName);
  const title = titleLocated.value.slice(0, 240);
  const codeLocated = locateLabel(lines, [/^(?:course|programme|module)?\s*code\s*[:\-–]\s*([A-Z0-9][A-Z0-9 ./_-]{2,30})$/i], 1);
  const generatedCode = `IMPORT-${title.replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase() || "COURSE"}`;
  const code = (codeLocated.value || generatedCode).replace(/\s+/g, "-").slice(0, 40);
  const overview = locateLabel(lines, [/^(?:course|programme|module)?\s*(?:overview|description|summary|rationale)\s*[:\-–]?\s*(.*)$/i], 5);
  const descriptionFallback = excerpt(lines.filter((line) => line !== titleLocated.value).slice(0, 6).join(" "), 1200);
  const description = sentence(overview.value || descriptionFallback || `${title} develops practical, assessable capability through structured learning and applied evidence.`, 1800);
  const audience = locateLabel(lines, [/^(?:intended|target)?\s*(?:audience|learners|participants)\s*[:\-–]?\s*(.*)$/i], 4);
  const prerequisites = locateLabel(lines, [/^(?:prerequisites?|entry requirements?|prior knowledge)\s*[:\-–]?\s*(.*)$/i], 4);
  const objectivesLocated = listAfterHeading(lines, [/^(?:course |programme |module |learning )?objectives?\s*:?$/i, /^aims?\s*:?$/i], 10);
  const outcomesLocated = listAfterHeading(lines, [/^(?:intended )?(?:learning |course |programme |module )?outcomes?\s*:?$/i, /^competenc(?:y|ies)\s*:?$/i], 12);
  const durationMatch = text.match(/\b(\d{1,3})\s*(?:notional |learning |contact )?hours?\b/i);
  const priceMatch = text.match(/(?:GHS|GH₵)\s*([\d,]+(?:\.\d{1,2})?)/i);
  const passMatch = text.match(/(?:pass(?:ing)?\s*(?:mark|score)?|minimum score)\D{0,12}(\d{1,3})\s*%/i);
  const attemptsMatch = text.match(/(?:attempts?|resubmissions?)\D{0,10}(\d{1,2})/i);
  const lower = text.toLowerCase();
  const deliveryPattern: CourseDesign["deliveryPattern"] = /blended|hybrid/.test(lower) ? "blended" : /face[- ]?to[- ]?face|in[- ]person|synchronous/.test(lower) ? "synchronous" : /online|self[- ]paced|asynchronous/.test(lower) ? "asynchronous" : "blended";
  const level: CourseDesign["level"] = /advanced|postgraduate|master/.test(lower) ? "advanced" : /foundation|introduct|beginner/.test(lower) ? "foundation" : "applied";
  const category: CourseDesign["category"] = /credit[- ]bearing|credit hours?|academic credit/.test(lower) ? "credit" : /recognition of prior learning|\brpl\b/.test(lower) ? "rpl" : "professional";
  const enrolmentMode: CourseDesign["enrolmentMode"] = /invitation only|nominated/.test(lower) ? "invitation" : /application|selection|admission/.test(lower) ? "application" : "open";

  const objectives = (objectivesLocated.items.length >= 2 ? objectivesLocated.items : [
    `Develop a coherent understanding of the principal concepts and practices covered in ${title}.`,
    `Enable learners to apply the manual's guidance to an authentic professional, academic or community task.`,
  ]).slice(0, 12);
  const rawOutcomes = outcomesLocated.items.length >= 2 ? outcomesLocated.items : objectives.slice(0, 4);
  const outcomes = rawOutcomes.map((item, index) => {
    const statement = makeObservable(item, index);
    return { id: `manual-outcome-${index + 1}`, statement, skill: outcomeSkill(statement), assessmentMethod: outcomeAssessment(statement) };
  }).slice(0, 12);
  const skills = inferSkills(text, title);

  let sourceSections = htmlHeadingSections(input.readableHtml);
  let sectionsConfirmed = sourceSections.length >= 2;
  if (sourceSections.length < 2) {
    sourceSections = numberedSections(lines);
    sectionsConfirmed = sourceSections.length >= 2;
  }
  if (sourceSections.length < 2) sourceSections = fallbackSections(text, title);
  if (sourceSections.length < 2) sourceSections = [{ title: "Orientation and foundations", body: text, excerpt: excerpt(text) }, { title: "Application and assessment", body: text, excerpt: excerpt(text) }];

  const sections = sourceSections.map((item, index) => ({
    id: `manual-section-${index + 1}`,
    title: item.title.slice(0, 200),
    description: sentence(excerpt(item.body, 500), 600),
  }));
  const accessibilityStatement = "The imported manual is retained as the source document and converted into structured, readable HTML learning blocks. The facilitator must verify headings, tables, images, links, alternative text, reading order and any required accessible equivalent before publication.";
  const design: CourseDesign = {
    category,
    deliveryPattern,
    level,
    language: /\bfrench\b/.test(lower) && !/\benglish\b/.test(lower) ? "French" : "English",
    expectedHours: Math.min(500, Math.max(1, Number(durationMatch?.[1] ?? Math.max(8, Math.ceil(text.split(/\s+/).length / 1800) * 6)))),
    enrolmentMode,
    priceGhs: Number((priceMatch?.[1] ?? "0").replaceAll(",", "")) || 0,
    intendedAudience: sentence(audience.value || "Professionals, students and lifelong learners who need practical capability in the subject covered by this manual.", 2000),
    prerequisites: sentence(prerequisites.value || "No formal prerequisite was identified in the manual. The facilitator must confirm the required prior knowledge, equipment and digital access.", 2000),
    accessibilityStatement,
    objectives,
    outcomes,
    skills,
    sections,
  };

  const rightsNote = "Facilitator-supplied manual — copyright, licence, attribution and learner-distribution rights require confirmation.";
  const materials: CourseMaterialRecord[] = [
    {
      id: "manual-original-source",
      title: `Original learning manual: ${title}`,
      kind: "Read",
      source: input.fileName,
      fileKey: input.fileKey,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sectionId: sections[0].id,
      sectionTitle: sections[0].title,
      unitTitle: "Original source and orientation",
      estimatedMinutes: Math.max(1, Math.ceil(text.split(/\s+/).filter(Boolean).length / 200)),
      outcomeIds: outcomes.map((item) => item.id),
      accessibilityChecked: false,
      license: rightsNote,
    },
    ...sourceSections.map((item, index) => ({
      id: `manual-learning-block-${index + 1}`,
      title: item.title,
      kind: "Read",
      source: input.fileName,
      readableHtml: textToReadableHtml(item.body),
      plainText: item.body,
      sectionId: sections[index].id,
      sectionTitle: sections[index].title,
      unitTitle: `Learning unit ${index + 1}`,
      estimatedMinutes: Math.max(3, Math.ceil(item.body.split(/\s+/).filter(Boolean).length / 200)),
      outcomeIds: mapOutcomes(item.body, outcomes, index),
      accessibilityChecked: false,
      license: rightsNote,
    } satisfies CourseMaterialRecord)),
  ];

  const assessmentModes = inferAssessmentModes(text);
  const foundQuestions = questionCandidates(lines);
  const questionPrompts = foundQuestions.length ? foundQuestions : [`How would you apply the principal concepts from ${title} to an authentic task, and what evidence would demonstrate success?`];
  const questions: ManualAssessmentQuestion[] = questionPrompts.slice(0, 8).map((prompt, index) => ({
    id: `manual-question-${index + 1}`,
    type: "Short answer",
    prompt,
    options: [],
    correctAnswer: "Facilitator-reviewed response aligned with the marking scheme.",
    points: 5,
    scheme: "Award marks for accurate use of course concepts, relevant evidence, justified reasoning and acknowledgement of limitations. The facilitator must adapt and confirm this scheme before submission for approval.",
    feedbackCorrect: "Your response uses relevant course evidence and provides a justified explanation.",
    feedbackIncorrect: "Revisit the linked learning block, identify the relevant concept and support your response with evidence.",
    learnerAdvice: "State the concept, apply it to the task, show the evidence and explain any limitations.",
    outcomeIds: [outcomes[index % outcomes.length].id],
  }));

  const review = (field: Omit<ManualFieldReview, "confidence"> & { confidence?: number }): ManualFieldReview => ({
    ...field,
    confidence: field.confidence ?? (field.status === "confirmed" ? 0.92 : field.status === "suggested" ? 0.68 : field.status === "needs_review" ? 0.45 : 0),
  });
  const reviews: ManualFieldReview[] = [
    review({ id: "title", group: "blueprint", label: "Course title", value: title, status: titleLocated.found ? "confirmed" : "suggested", sourceExcerpt: titleLocated.excerpt, guidance: "Confirm that the title is concise, distinctive and suitable for the public catalogue." }),
    review({ id: "code", group: "blueprint", label: "Course code", value: code, status: codeLocated.found ? "confirmed" : "suggested", sourceExcerpt: codeLocated.excerpt, guidance: "Replace generated codes with the approved institutional code." }),
    review({ id: "description", group: "blueprint", label: "Course description", value: description, status: overview.found ? "confirmed" : "suggested", sourceExcerpt: overview.excerpt || excerpt(descriptionFallback), guidance: "Check that the description explains learner value, capability and evidence." }),
    review({ id: "audience", group: "blueprint", label: "Intended audience", value: design.intendedAudience, status: audience.found ? "confirmed" : "suggested", sourceExcerpt: audience.excerpt, guidance: "Confirm the learner group and professional context." }),
    review({ id: "prerequisites", group: "blueprint", label: "Prerequisites", value: design.prerequisites, status: prerequisites.found ? "confirmed" : "needs_review", sourceExcerpt: prerequisites.excerpt, guidance: "Confirm prior knowledge, equipment, software and connectivity requirements." }),
    review({ id: "delivery", group: "blueprint", label: "Delivery, level and workload", value: `${deliveryPattern} · ${level} · ${design.expectedHours} hours`, status: durationMatch ? "confirmed" : "suggested", sourceExcerpt: durationMatch ? excerpt(durationMatch[0]) : "", guidance: "Verify workload against all reading, practice and assessment time." }),
    review({ id: "objectives", group: "outcomes", label: "Course objectives", value: `${objectives.length} objectives`, status: objectivesLocated.found && objectivesLocated.items.length >= 2 ? "confirmed" : "suggested", sourceExcerpt: objectivesLocated.excerpt, guidance: "Objectives should describe what the course is designed to accomplish." }),
    review({ id: "outcomes", group: "outcomes", label: "Measurable outcomes", value: `${outcomes.length} outcomes with skills and evidence methods`, status: outcomesLocated.found && outcomesLocated.items.length >= 2 ? "confirmed" : "suggested", sourceExcerpt: outcomesLocated.excerpt, guidance: "Confirm observable verbs and the evidence required for each outcome." }),
    review({ id: "skills", group: "outcomes", label: "Skills and capabilities", value: skills.join(" · "), status: "suggested", sourceExcerpt: "", guidance: "Keep only skills demonstrably taught and assessed by this course." }),
    review({ id: "sections", group: "content", label: "Course structure", value: `${sections.length} sections and ${materials.length} learning blocks`, status: sectionsConfirmed ? "confirmed" : "suggested", sourceExcerpt: sourceSections.map((item) => item.title).join(" · "), guidance: "Check sequence, lesson boundaries and estimated study time." }),
    review({ id: "readable", group: "content", label: "Readable lesson conversion", value: `${materials.length} accessible draft blocks created`, status: "needs_review", sourceExcerpt: excerpt(text), guidance: "Inspect headings, tables, images, formulas and reading order against the original manual." }),
    review({ id: "rights", group: "content", label: "Copyright and distribution rights", value: "Confirmation required before publication", status: "missing", sourceExcerpt: "", guidance: "Record ownership, licence, attribution and permission to distribute the manual to learners." }),
    review({ id: "assessmentModes", group: "assessment", label: "Assessment methods", value: assessmentModes.join(" · "), status: "suggested", sourceExcerpt: excerpt(lines.filter((line) => /assess|quiz|assignment|project|practical|exam/i.test(line)).slice(0, 4).join(" ")), guidance: "Confirm that every selected method produces valid evidence for an outcome." }),
    review({ id: "questions", group: "assessment", label: "Assessment questions", value: `${questions.length} editable short-answer draft${questions.length === 1 ? "" : "s"}`, status: foundQuestions.length ? "needs_review" : "suggested", sourceExcerpt: excerpt(foundQuestions.join(" ")), guidance: "Confirm prompts, answers, marks, feedback, academic integrity and outcome mapping." }),
    review({ id: "activities", group: "assessment", label: "Colab or virtual-lab activities", value: "No specialist activity added automatically", status: "needs_review", sourceExcerpt: "", guidance: "Add an activity only when it is required by the manual and a valid notebook or approved practical is available." }),
    review({ id: "certificate", group: "assessment", label: "Credential gate", value: `Identity verification + ${Math.min(100, Math.max(1, Number(passMatch?.[1] ?? 70)))}% pass mark + required activities`, status: "suggested", sourceExcerpt: passMatch ? excerpt(passMatch[0]) : "", guidance: "The certificate rule must be approved by UCC before publication." }),
  ];
  const countsByStatus = (status: ManualImportStatus) => reviews.filter((item) => item.status === status).length;
  const coverageScore = Math.round(reviews.reduce((sum, item) => sum + statusWeight(item.status), 0) / reviews.length * 100);

  return {
    source: { fileName: input.fileName, fileKey: input.fileKey, mimeType: input.mimeType, wordCount: text.split(/\s+/).filter(Boolean).length, conversionNote: input.conversionNote },
    course: { code, title, description, discipline: classifyDiscipline(text) },
    design,
    materials,
    assessmentModes,
    assessmentConfig: { passMark: Math.min(100, Math.max(1, Number(passMatch?.[1] ?? 70))), attempts: String(Math.min(10, Math.max(1, Number(attemptsMatch?.[1] ?? 3)))), questions },
    gateRequired: true,
    questionLimit: Math.max(10, questions.length),
    certificateEnabled: true,
    reviews,
    warnings: [
      "The import creates an unsaved draft. It cannot publish a course or issue a credential.",
      "Suggested and needs-review fields were inferred from the manual and require facilitator confirmation.",
      "Check the readable HTML against the original document, especially tables, images, formulas and references.",
      "Confirm copyright, privacy, accessibility, academic integrity and assessment validity before UCC review.",
    ],
    coverageScore,
    counts: {
      objectives: objectives.length,
      outcomes: outcomes.length,
      skills: skills.length,
      sections: sections.length,
      learningBlocks: materials.length,
      questions: questions.length,
      confirmed: countsByStatus("confirmed"),
      suggested: countsByStatus("suggested"),
      needsReview: countsByStatus("needs_review"),
      missing: countsByStatus("missing"),
    },
  };
}
