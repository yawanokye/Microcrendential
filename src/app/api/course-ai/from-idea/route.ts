import { requireActiveProfile } from "@/lib/accounts";
import { generateCourseDesignSuggestion } from "@/lib/ai-course-studio";
import { defaultCourseDesign, type CourseDesign, type CourseMaterialRecord } from "@/lib/course-design";
import { extractReadableContent, plainTextFromHtml, textToReadableHtml } from "@/lib/document-content";
import { putStoredFile } from "@/lib/render-storage";
import { recordAudit } from "@/lib/audit";
import { rejectCrossSiteMutation } from "@/lib/request-security";

const accepted = new Set(["pdf", "docx", "txt", "md", "html", "htm", "rtf"]);

export async function POST(request: Request) {
  const origin = rejectCrossSiteMutation(request);
  if (origin) return origin;
  const account = await requireActiveProfile(["facilitator", "admin"]);
  if (account.error || !account.profile) return account.error;
  const form = await request.formData();
  const typedIdea = String(form.get("idea") ?? "").trim();
  const file = form.get("file");
  let sourceText = typedIdea;
  let sourceFile: { key: string; name: string; type: string } | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > 10 * 1024 * 1024) return Response.json({ error: "Synopsis files must be 10 MB or smaller." }, { status: 413 });
    const extension = file.name.toLowerCase().split(".").pop() ?? "";
    if (!accepted.has(extension)) return Response.json({ error: "Upload a PDF, DOCX, TXT, Markdown, HTML or RTF synopsis." }, { status: 415 });
    try {
      const extracted = extractReadableContent(Buffer.from(await file.arrayBuffer()), file.name, file.type);
      if (extracted.text.length < 40) return Response.json({ error: "The synopsis file did not contain enough readable text." }, { status: 422 });
      sourceText = [typedIdea, extracted.text].filter(Boolean).join("\n\n");
      const key = await putStoredFile("course-synopses", file, { contentType: file.type || "application/octet-stream", originalName: file.name, ownerEmail: account.profile.email, evidenceKind: "course-synopsis" });
      sourceFile = { key, name: file.name, type: file.type || "application/octet-stream" };
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : "The synopsis could not be read." }, { status: 422 });
    }
  }
  if (sourceText.length < 40) return Response.json({ error: "Describe the course idea in at least 40 characters or upload a readable synopsis." }, { status: 400 });
  if (sourceText.length > 300_000) sourceText = sourceText.slice(0, 300_000);
  try {
    const generated = await generateCourseDesignSuggestion({ title: "New course from facilitator synopsis", discipline: "Interdisciplinary", description: sourceText.slice(0, 1200), design: defaultCourseDesign(), sourceText, workload: "balanced", instruction: String(form.get("instruction") ?? "Build a complete introductory microcredential from this synopsis, including teachable learning blocks, resource discovery queries, authentic activities and assessment questions.") });
    const suggestion = generated.suggestion;
    const design: CourseDesign = {
      ...defaultCourseDesign(),
      intendedAudience: suggestion.intendedAudience,
      prerequisites: suggestion.prerequisites,
      accessibilityStatement: suggestion.accessibilityStatement,
      objectives: suggestion.objectives,
      outcomes: suggestion.outcomes,
      skills: suggestion.skills,
      sections: suggestion.sections,
      enrolmentMode: "open",
      priceGhs: 0,
      certificateFeeGhs: 0,
    };
    const sectionIds = new Set(design.sections.map((section) => section.id));
    const outcomeIds = new Set(design.outcomes.map((outcome) => outcome.id));
    const materials: CourseMaterialRecord[] = suggestion.learningBlocks.map((block, index) => {
      const section = design.sections.find((item) => item.id === block.sectionId) ?? design.sections[index % design.sections.length];
      const readableHtml = textToReadableHtml(block.contentMarkdown);
      return {
        id: `ai-idea-material-${index + 1}`,
        title: block.title,
        kind: "Read",
        source: "AI-assisted facilitator-authored draft",
        readableHtml,
        plainText: plainTextFromHtml(readableHtml),
        sectionId: sectionIds.has(block.sectionId) ? block.sectionId : section?.id,
        sectionTitle: section?.title,
        unitTitle: `Learning unit ${index + 1}`,
        estimatedMinutes: block.estimatedMinutes,
        outcomeIds: block.outcomeIds.filter((id) => outcomeIds.has(id)).length ? block.outcomeIds.filter((id) => outcomeIds.has(id)) : design.outcomes[index % design.outcomes.length]?.id ? [design.outcomes[index % design.outcomes.length].id] : [],
        accessibilityChecked: false,
        required: true,
        license: "Course-authored draft; facilitator must verify accuracy, originality and permissions",
      };
    });
    const questions = suggestion.assessmentQuestions.map((question, index) => ({ ...question, id: `ai-idea-question-${index + 1}`, outcomeIds: question.outcomeIds.filter((id) => outcomeIds.has(id)).length ? question.outcomeIds.filter((id) => outcomeIds.has(id)) : design.outcomes[0]?.id ? [design.outcomes[0].id] : [] }));
    await recordAudit(account.profile.email, "course.ai_idea_generated", { model: generated.model, workload: generated.workload, sourceFile: sourceFile?.name ?? null, materials: materials.length, resources: suggestion.resourceSuggestions.length, activities: suggestion.activitySuggestions.length, questions: questions.length });
    return Response.json({
      draft: {
        title: suggestion.title,
        code: `UCC-MC-${String(Date.now()).slice(-6)}`,
        discipline: suggestion.discipline,
        description: suggestion.description,
        design,
        materials,
        activities: [],
        assessmentModes: ["Objective quiz", "Applied assignment"],
        assessmentConfig: { passMark: 60, attempts: "2", questions, questionFiles: [] },
        gateRequired: true,
        questionLimit: Math.max(10, questions.length),
        certificateEnabled: true,
      },
      resourceSuggestions: suggestion.resourceSuggestions,
      activitySuggestions: suggestion.activitySuggestions,
      sourceFile,
      model: generated.model,
      rationale: suggestion.rationale,
      warning: "This is an AI-assisted, unsaved draft. Verify factual accuracy, instructional quality, assessment answers, accessibility, copyright and every external resource before academic review.",
    }, { status: 201 });
  } catch (error) {
    await recordAudit(account.profile.email, "course.ai_idea_failed", { sourceFile: sourceFile?.name ?? null, error: error instanceof Error ? error.message : "Unknown error" });
    return Response.json({ error: error instanceof Error ? error.message : "The AI could not build a course from this synopsis." }, { status: 502 });
  }
}
