import { requireActiveProfile } from "@/lib/accounts";
import { courseAiStatus, generateCourseAiProposal, type CourseAiMode, type CourseAiProvider } from "@/lib/course-ai";
import { extractReadableContent } from "@/lib/document-content";
import { validatePublicHttpUrl } from "@/lib/public-url";
import { putStoredFile } from "@/lib/render-storage";
import { rejectCrossSiteMutation } from "@/lib/request-security";
import { recordAudit } from "@/lib/audit";

const manualExtensions = new Set(["pdf", "docx", "txt", "md", "html", "htm", "rtf"]);
const mediaExtensions = new Set(["mp3", "wav", "m4a", "aac", "ogg", "mp4", "webm", "mov", "mpeg", "mpg"]);
const field = (form: FormData, key: string, maximum = 100_000) => String(form.get(key) ?? "").trim().slice(0, maximum);

export async function GET() {
  const account = await requireActiveProfile(["facilitator", "admin"]);
  if (account.error) return account.error;
  return Response.json(courseAiStatus());
}

export async function POST(request: Request) {
  const origin = rejectCrossSiteMutation(request); if (origin) return origin;
  const account = await requireActiveProfile(["facilitator", "admin"]);
  if (account.error || !account.profile) return account.error;

  try {
    const form = await request.formData();
    const requestedMode = field(form, "mode", 20) as CourseAiMode;
    const mode: CourseAiMode = ["idea", "manual", "media", "improve"].includes(requestedMode) ? requestedMode : "idea";
    const requestedProvider = field(form, "provider", 20) as CourseAiProvider;
    const provider: CourseAiProvider = ["auto", "openai", "vertex"].includes(requestedProvider) ? requestedProvider : "auto";
    const sectionCount = Math.min(12, Math.max(2, Number(field(form, "sectionCount", 3)) || 6));
    const preferredTitle = field(form, "preferredTitle", 240); const preferredDiscipline = field(form, "preferredDiscipline", 160);
    let sourceText = field(form, "sourceText", 100_000); let sourceFile: { key: string; name: string; mimeType: string } | undefined;
    let media: { mimeType: string; dataBase64?: string; publicUrl?: string; name?: string } | undefined;
    const file = form.get("file");

    if (mode === "manual") {
      if (!(file instanceof File)) return Response.json({ error: "Choose a searchable PDF, DOCX, TXT, Markdown, HTML or RTF manual." }, { status: 400 });
      if (file.size > 25 * 1024 * 1024) return Response.json({ error: "Learning manuals must be 25 MB or smaller." }, { status: 413 });
      const extension = file.name.toLowerCase().split(".").pop() || "";
      if (!manualExtensions.has(extension)) return Response.json({ error: "Use a searchable PDF, DOCX, TXT, Markdown, HTML or RTF manual." }, { status: 415 });
      const body = Buffer.from(await file.arrayBuffer()); const mimeType = extension === "pdf" ? "application/pdf" : file.type || "application/octet-stream";
      const extracted = extractReadableContent(body, file.name, mimeType);
      if (extracted.wordCount < 35) return Response.json({ error: "The document did not expose enough readable text. Run OCR for a scanned PDF or upload an accessible DOCX." }, { status: 422 });
      sourceText = extracted.text.slice(0, 100_000);
      const stored = new File([body], file.name, { type: mimeType }); const key = await putStoredFile("course-materials", stored, { contentType: mimeType, originalName: file.name, ownerEmail: account.profile.email, evidenceKind: "course-material" });
      sourceFile = { key, name: file.name, mimeType };
    } else if (mode === "media") {
      const youtubeUrl = field(form, "youtubeUrl", 3000);
      if (file instanceof File) {
        if (file.size > 15 * 1024 * 1024) return Response.json({ error: "Direct AI media analysis is limited to 15 MB. For a larger or 30-minute video, use a public YouTube URL." }, { status: 413 });
        const extension = file.name.toLowerCase().split(".").pop() || "";
        if (!mediaExtensions.has(extension)) return Response.json({ error: "Use MP3, WAV, M4A, AAC, OGG, MP4, WebM, MOV or MPEG media." }, { status: 415 });
        const body = Buffer.from(await file.arrayBuffer()); const mimeType = file.type || (extension === "mp3" ? "audio/mpeg" : extension === "wav" ? "audio/wav" : "video/mp4");
        const stored = new File([body], file.name, { type: mimeType }); const key = await putStoredFile("course-materials", stored, { contentType: mimeType, originalName: file.name, ownerEmail: account.profile.email, evidenceKind: "course-material" });
        sourceFile = { key, name: file.name, mimeType }; media = { mimeType, dataBase64: body.toString("base64"), name: file.name };
        sourceText = sourceText || `Analyse the supplied ${mimeType.startsWith("audio/") ? "audio" : "video"} and design a course from its teachable concepts.`;
      } else if (youtubeUrl) {
        const url = await validatePublicHttpUrl(youtubeUrl); const host = url.hostname.toLowerCase().replace(/^www\./, "");
        if (!(host === "youtu.be" || host.endsWith("youtube.com"))) return Response.json({ error: "For URL-based media analysis, use a public YouTube link." }, { status: 400 });
        media = { mimeType: "video/mp4", publicUrl: url.toString(), name: "Public YouTube video" };
        sourceText = sourceText || "Analyse this public YouTube teaching video and design a course from its teachable concepts.";
      } else return Response.json({ error: "Upload an audio/video file or paste a public YouTube URL." }, { status: 400 });
    } else if (sourceText.length < 30) {
      return Response.json({ error: mode === "improve" ? "The current draft is too small to improve." : "Describe the course idea in at least 30 characters." }, { status: 400 });
    }

    const proposal = await generateCourseAiProposal({ mode, provider, sourceText, sectionCount, preferredTitle, preferredDiscipline, sourceFile, media });
    await recordAudit(account.profile.email, "course.ai_proposal_generated", { provider: proposal.provider, model: proposal.model, mode, sections: proposal.draft.design.sections.length, questions: proposal.draft.assessmentConfig.questions.length });
    return Response.json({ proposal }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The AI course proposal could not be generated.";
    const timeout = /timeout|aborted/i.test(message);
    return Response.json({ error: timeout ? "The AI provider did not finish within 45 seconds. Try fewer sections or a shorter source." : message }, { status: timeout ? 504 : 502 });
  }
}
