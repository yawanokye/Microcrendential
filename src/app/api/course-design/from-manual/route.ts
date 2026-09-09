import { requireActiveProfile } from "@/lib/accounts";
import { extractReadableContent, textToReadableHtml } from "@/lib/document-content";
import { putStoredFile } from "@/lib/render-storage";

const supported = new Set(["pdf", "docx", "txt", "md", "html", "htm", "rtf"]);
const cleanLine = (value: string) => value.replace(/^[\s•*\-–—\d.)]+/, "").replace(/\s+/g, " ").trim();
const sentence = (value: string, fallback: string) => cleanLine(value).slice(0, 600) || fallback;

function linesBelow(lines: string[], heading: RegExp, maximum = 6) {
  const start = lines.findIndex((line) => heading.test(line));
  if (start < 0) return [];
  const collected: string[] = [];
  for (const raw of lines.slice(start + 1)) {
    const line = cleanLine(raw);
    if (!line) continue;
    if (collected.length && /^(chapter|module|unit|section|topic|assessment|references?|bibliography)\b/i.test(line)) break;
    if (line.length >= 12) collected.push(line);
    if (collected.length >= maximum) break;
  }
  return collected;
}

function titleFrom(lines: string[], fileName: string) {
  const candidate = lines.find((line) => {
    const text = cleanLine(line);
    return text.length >= 8 && text.length <= 160 && !/^(table of contents|contents|copyright|university of cape coast)$/i.test(text);
  });
  return sentence(candidate || fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "), "Imported microcredential");
}

export async function POST(request: Request) {
  const account = await requireActiveProfile(["facilitator", "admin"]);
  if (account.error || !account.profile) return account.error;
  const form = await request.formData();
  const file = form.get("manual");
  if (!(file instanceof File)) return Response.json({ error: "Choose a learning manual to analyse." }, { status: 400 });
  if (file.size > 25 * 1024 * 1024) return Response.json({ error: "The manual must be 25 MB or smaller." }, { status: 413 });
  const extension = file.name.toLowerCase().split(".").pop() ?? "";
  if (!supported.has(extension)) return Response.json({ error: "Use PDF, DOCX, TXT, Markdown, HTML or RTF." }, { status: 415 });

  const buffer = Buffer.from(await file.arrayBuffer());
  let extracted;
  try { extracted = extractReadableContent(buffer, file.name, file.type); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "The manual could not be read." }, { status: 422 }); }
  if (extracted.text.length < 200) return Response.json({ error: "The manual did not expose enough readable text. For a scanned PDF, upload a text-searchable/OCR version." }, { status: 422 });
  const manualKey = await putStoredFile("course-materials", file, { contentType: file.type || "application/octet-stream", originalName: file.name, ownerEmail: account.profile.email, evidenceKind: "course-manual" });

  const rawLines = extracted.text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const title = titleFrom(rawLines, file.name);
  const objectives = linesBelow(rawLines, /^(course\s+)?(objectives?|aims?|purpose)\b/i, 6);
  const outcomeLines = linesBelow(rawLines, /^(learning|course|programme)?\s*outcomes?|competenc(?:y|ies)/i, 6);
  const objectivesFinal = (objectives.length >= 2 ? objectives : [
    "Build an accurate understanding of the central concepts and procedures presented in the learning manual.",
    "Enable learners to apply the manual's guidance to an authentic professional, academic or community task.",
  ]).slice(0, 8);
  const outcomes = (outcomeLines.length >= 2 ? outcomeLines : [
    "Explain the core concepts, terminology and responsible practices presented in the manual.",
    "Apply the prescribed process to complete a relevant practical task and document the evidence produced.",
    "Evaluate the quality, limitations and implications of the completed work.",
  ]).slice(0, 8).map((statement, index) => ({
    id: `manual-outcome-${index + 1}`,
    statement: sentence(statement, `Demonstrate learning outcome ${index + 1} from the manual.`),
    skill: index === 0 ? "Conceptual understanding" : index === 1 ? "Applied problem-solving" : "Critical thinking",
    assessmentMethod: index === 0 ? "Objective knowledge check" : index === 1 ? "Practical assignment or portfolio evidence" : "Scenario response and reflective justification",
  }));

  const detectedSections = rawLines.filter((line) => /^(chapter|module|unit|section|topic)\s*[\dIVXLC-]*[:.)\s-]+\S/i.test(line)).slice(0, 10);
  const sections = (detectedSections.length ? detectedSections : ["Orientation and foundations", "Guided application", "Evidence, reflection and assessment"]).map((heading, index) => ({
    id: `manual-section-${index + 1}`,
    title: sentence(heading.replace(/^(chapter|module|unit|section|topic)\s*[\dIVXLC-]*[:.)\s-]*/i, ""), `Section ${index + 1}`),
    description: index === 0 ? "Introduce the course purpose, language, core concepts and expectations." : index === 1 ? "Guide learners through applied examples, practice and feedback." : "Consolidate evidence, reflection and assessed demonstration of the outcomes.",
  }));

  const words = extracted.text.split(/\s+/).filter(Boolean);
  const chunkSize = Math.max(250, Math.ceil(words.length / Math.max(2, Math.min(8, sections.length * 2))));
  const chunks: string[] = [];
  for (let start = 0; start < words.length && chunks.length < 10; start += chunkSize) chunks.push(words.slice(start, start + chunkSize).join(" "));
  while (chunks.length < 2) chunks.push("Review the supplied learning manual, identify the central concepts and record questions for the facilitator.");
  const materials = chunks.map((text, index) => {
    const section = sections[index % sections.length];
    const outcome = outcomes[index % outcomes.length];
    return { id: `manual-material-${index + 1}`, title: index === 0 ? "Learning manual: orientation and key concepts" : `Manual study block ${index + 1}`, kind: "Read", source: file.name, readableHtml: textToReadableHtml(text), plainText: text, fileKey: index === 0 ? manualKey : undefined, fileName: index === 0 ? file.name : undefined, mimeType: index === 0 ? (file.type || "application/octet-stream") : undefined, sectionId: section.id, sectionTitle: section.title, unitTitle: `Study unit ${index + 1}`, estimatedMinutes: Math.max(2, Math.ceil(text.split(/\s+/).length / 200)), outcomeIds: [outcome.id], accessibilityChecked: true, license: "Institution-supplied learning manual; facilitator must confirm permission and attribution" };
  });
  for (const [index, outcome] of outcomes.entries()) if (!materials.some((material) => material.outcomeIds.includes(outcome.id))) materials[index % materials.length].outcomeIds.push(outcome.id);

  const descriptionText = rawLines.slice(1, 8).join(" ");
  const suffix = new Date().toISOString().slice(2, 10).replaceAll("-", "");
  return Response.json({
    draft: {
      code: `DRAFT-MAN-${suffix}`,
      title,
      discipline: "Interdisciplinary",
      description: sentence(descriptionText, `A guided microcredential developed from ${file.name}, combining structured study, applied practice and assessed evidence.`).slice(0, 1200),
      design: {
        category: "professional", deliveryPattern: "blended", level: "applied", language: "English", expectedHours: Math.max(4, Math.ceil(words.length / 1800)),
        enrolmentMode: "open", priceGhs: 0,
        intendedAudience: "Learners and professionals who need a structured, assessed introduction to the subject covered by this manual.",
        prerequisites: "No formal prerequisite unless the facilitator adds one after reviewing the source manual.",
        accessibilityStatement: "Readable HTML is provided from the uploaded manual. The facilitator must review headings, tables, images, alternative text and reading order before submission.",
        objectives: objectivesFinal, outcomes, skills: [...new Set(outcomes.map((item) => item.skill))], sections,
      },
      materials,
      activities: [],
      assessmentModes: ["Objective quiz", "Practical assignment", "Authentic evidence"],
      assessmentConfig: {
        passMark: 70, attempts: "3",
        questions: outcomes.map((outcome, index) => ({ id: `manual-question-${index + 1}`, type: index === 0 ? "Short answer" : "Scenario response", prompt: index === 0 ? "Explain one central concept from the manual and give an accurate example." : `Describe how you would demonstrate this outcome in practice: ${outcome.statement}`, options: [], correctAnswer: "The response must accurately use the manual, show an appropriate application and acknowledge any relevant limitations.", points: 5, scheme: "Accuracy: 2 marks; relevant application: 2 marks; clarity and limitations: 1 mark.", feedbackCorrect: "Well done. Your response demonstrates the required evidence.", feedbackIncorrect: "Review the relevant manual section and strengthen the evidence in your response.", learnerAdvice: "Cite the relevant section, explain your reasoning and connect the answer to a realistic context.", outcomeIds: [outcome.id] })),
        questionFiles: [],
      },
      gateRequired: true,
      questionLimit: outcomes.length,
      certificateEnabled: true,
      certificateFeeGhs: 0,
    },
    analysis: { sourceFileName: file.name, wordCount: words.length, detectedObjectives: objectives.length, detectedOutcomes: outcomeLines.length, detectedSections: detectedSections.length, note: "Review every generated field against the source before saving or submitting. Automatic extraction proposes a draft; it does not approve academic accuracy." },
  }, { status: 201 });
}
