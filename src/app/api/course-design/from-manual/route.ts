import { requireActiveProfile } from "@/lib/accounts";
import { defaultCourseDesign, type CourseMaterialRecord, type LearningOutcome } from "@/lib/course-design";
import { extractReadableContent, textToReadableHtml } from "@/lib/document-content";
import { putStoredFile } from "@/lib/render-storage";
import { rejectCrossSiteMutation } from "@/lib/request-security";
import { recordAudit } from "@/lib/audit";

const accepted = new Set(["pdf", "docx", "txt", "md", "html", "htm", "rtf"]);
const observable = /^(analyse|analyze|apply|assess|build|calculate|compare|create|critique|define|demonstrate|describe|design|develop|differentiate|evaluate|explain|identify|implement|interpret|justify|measure|plan|produce|solve|use)\b/i;

const cleanLine = (value: string) => value.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").replace(/\s+/g, " ").trim();
const sentences = (text: string) => text.split(/(?<=[.!?])\s+|\n+/).map(cleanLine).filter((item) => item.length >= 25 && item.length <= 360);
const titleCase = (value: string) => value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().replace(/\b\w/g, (letter) => letter.toUpperCase());

function candidateTitle(text: string, fileName: string) {
  const first = text.split(/\n+/).map(cleanLine).find((line) => line.length >= 8 && line.length <= 140 && !/^(table of contents|contents|copyright|page \d+)/i.test(line));
  return (first || titleCase(fileName.replace(/\.[^.]+$/, ""))).slice(0, 180);
}

function extractObjectives(text: string) {
  const candidates = sentences(text).filter((item) => observable.test(item) || /^(to\s+)(analyse|analyze|apply|assess|build|compare|create|demonstrate|design|develop|evaluate|explain|identify|interpret|justify|understand|use)\b/i.test(item));
  return [...new Set(candidates)].slice(0, 5);
}

function deriveOutcomes(objectives: string[]): LearningOutcome[] {
  const defaults = defaultCourseDesign().outcomes;
  const source = objectives.length >= 2 ? objectives : defaults.map((item) => item.statement);
  return source.slice(0, 6).map((statement, index) => {
    const withoutTo = statement.replace(/^to\s+/i, "");
    const measurable = observable.test(withoutTo) ? withoutTo : `Explain and apply ${withoutTo.replace(/[.!?]+$/, "").toLowerCase()}.`;
    return {
      id: `manual-outcome-${index + 1}`,
      statement: measurable.charAt(0).toUpperCase() + measurable.slice(1),
      skill: /data|evidence|research/i.test(measurable) ? "Data literacy" : /design|create|develop|build/i.test(measurable) ? "Applied problem-solving" : "Conceptual understanding",
      assessmentMethod: index === 0 ? "Objective knowledge check" : "Applied assignment or practical evidence",
    };
  });
}

function deriveSections(text: string) {
  const headingLines = text.split(/\n+/).map(cleanLine).filter((line) => line.length >= 4 && line.length <= 100 && (/^(module|unit|chapter|section|topic|part)\s+\w+/i.test(line) || /^[A-Z][A-Z\s&:,()-]{5,}$/.test(line)));
  const titles = [...new Set(headingLines.map((line) => titleCase(line.toLowerCase())))].slice(0, 6);
  const finalTitles = titles.length >= 2 ? titles : ["Orientation and foundations", "Core concepts and guided practice", "Application and assessment"];
  return finalTitles.map((title, index) => ({ id: `manual-section-${index + 1}`, title, description: `Learning from the uploaded manual organised around ${title.toLowerCase()}.` }));
}

function sectionBodies(html: string, text: string, count: number) {
  const headingParts = html.split(/(?=<h[1-4]>)/i).filter((part) => part.replace(/<[^>]+>/g, " ").trim().length > 80);
  if (headingParts.length >= count) return headingParts.slice(0, count - 1).concat(headingParts.slice(count - 1).join(""));
  const paragraphs = html.match(/<(?:h[1-6]|p|ul|ol|blockquote|table)>[\s\S]*?<\/(?:h[1-6]|p|ul|ol|blockquote|table)>/gi) ?? [];
  if (paragraphs.length >= count) {
    const perSection = Math.ceil(paragraphs.length / count);
    return Array.from({ length: count }, (_, index) => paragraphs.slice(index * perSection, (index + 1) * perSection).join(""));
  }
  const words = text.split(/\s+/).filter(Boolean), chunkSize = Math.max(350, Math.ceil(words.length / count));
  return Array.from({ length: count }, (_, index) => textToReadableHtml(words.slice(index * chunkSize, index === count - 1 ? words.length : (index + 1) * chunkSize).join(" ")));
}

function buildMaterials(html: string, text: string, sections: ReturnType<typeof deriveSections>, outcomes: LearningOutcome[], original: { key: string; name: string; type: string }, source: string): CourseMaterialRecord[] {
  const bodies = sectionBodies(html, text, sections.length);
  return sections.map((section, index) => {
    const readableHtml = bodies[index] || `<h2>${section.title}</h2><p>Review the facilitator manual content related to this section.</p>`;
    const readable = readableHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return {
      id: `manual-material-${index + 1}`,
      title: index === 0 ? `Start here: ${section.title}` : section.title,
      kind: "Read",
      source,
      readableHtml,
      plainText: readable,
      sectionId: section.id,
      sectionTitle: section.title,
      unitTitle: `Learning unit ${index + 1}`,
      estimatedMinutes: Math.max(5, Math.ceil(readable.split(/\s+/).length / 180)),
      outcomeIds: [outcomes[index % outcomes.length]?.id, outcomes[(index + 1) % outcomes.length]?.id].filter(Boolean),
      accessibilityChecked: true,
      required: true,
      license: "Facilitator-supplied course manual; rights and attribution must be reviewed",
      fileKey: original.key,
      fileName: original.name,
      mimeType: original.type,
    };
  });
}

export async function POST(request: Request) {
  const origin = rejectCrossSiteMutation(request);
  if (origin) return origin;
  const account = await requireActiveProfile(["facilitator", "admin"]);
  if (account.error || !account.profile) return account.error;
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Choose a PDF, DOCX, text, Markdown, HTML or RTF course manual." }, { status: 400 });
  if (file.size > 25 * 1024 * 1024) return Response.json({ error: "Course manuals must be 25 MB or smaller." }, { status: 413 });
  const extension = file.name.toLowerCase().split(".").pop() ?? "";
  if (!accepted.has(extension)) return Response.json({ error: "Use PDF, DOCX, TXT, MD, HTML or RTF for automatic course design." }, { status: 415 });
  const buffer = Buffer.from(await file.arrayBuffer());
  let extracted;
  try { extracted = extractReadableContent(buffer, file.name, file.type); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "The manual could not be read." }, { status: 422 }); }
  if (extracted.text.length < 200) return Response.json({ error: "The manual did not expose enough readable text. For a scanned PDF, run OCR or upload an accessible DOCX version." }, { status: 422 });
  const fileKey = await putStoredFile("course-materials", file, { contentType: file.type || "application/octet-stream", originalName: file.name, ownerEmail: account.profile.email, evidenceKind: "course-material" });
  const title = candidateTitle(extracted.text, file.name);
  const extractedObjectives = extractObjectives(extracted.text);
  const outcomes = deriveOutcomes(extractedObjectives);
  const sections = deriveSections(extracted.text);
  const design = {
    ...defaultCourseDesign(),
    enrolmentMode: "open" as const,
    priceGhs: 0,
    certificateFeeGhs: 0,
    expectedHours: Math.min(120, Math.max(4, Math.ceil(extracted.wordCount / 750))),
    objectives: extractedObjectives.length >= 2 ? extractedObjectives : [
      `Build a practical understanding of ${title.toLowerCase()}.`,
      `Enable learners to apply the manual's guidance in an authentic context.`,
    ],
    outcomes,
    sections,
    skills: [...new Set(outcomes.map((item) => item.skill))],
  };
  const descriptionSource = sentences(extracted.text).slice(0, 4).join(" ");
  const description = (descriptionSource.length >= 80 ? descriptionSource : `This microcredential uses the uploaded facilitator manual to build practical understanding and assess authentic application of ${title}.`).slice(0, 1200);
  const materials = buildMaterials(extracted.html, extracted.text, sections, outcomes, { key: fileKey, name: file.name, type: file.type || "application/octet-stream" }, account.profile.full_name || account.profile.email);
  const questions = outcomes.slice(0, 3).map((outcome, index) => ({
    id: `manual-question-${index + 1}`,
    type: index === 0 ? "Short answer" : "Scenario response",
    prompt: index === 0 ? `Explain the central concept addressed by this outcome: ${outcome.statement}` : `Apply this outcome to a realistic professional or community situation: ${outcome.statement}`,
    options: [], points: index === 0 ? 5 : 10,
    scheme: "Award marks for accurate use of the manual, a justified application, and acknowledgement of relevant limitations.",
    feedbackCorrect: "The response demonstrates the expected outcome.",
    feedbackIncorrect: "Revisit the linked manual section and strengthen the evidence used in your response.",
    learnerAdvice: "Refer directly to the course manual and explain how the guidance supports your answer.",
    outcomeIds: [outcome.id],
  }));
  await recordAudit(account.profile.email, "course.manual_imported", { fileName: file.name, wordCount: extracted.wordCount, sections: sections.length });
  return Response.json({
    draft: {
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
    },
    extraction: { fileName: file.name, wordCount: extracted.wordCount, conversionNote: extracted.note },
    warning: "Automatic extraction creates an editable draft, not an approved course. The facilitator must verify the title, objectives, outcomes, sequencing, accessibility, assessment answers, copyright and attribution before submission.",
  }, { status: 201 });
}
