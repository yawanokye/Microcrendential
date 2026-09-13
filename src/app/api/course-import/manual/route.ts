import { requireActiveProfile } from "@/lib/accounts";
import { recordAudit } from "@/lib/audit";
import { extractReadableContent } from "@/lib/document-content";
import { buildManualCourseProposal } from "@/lib/manual-course-import";
import { rejectCrossSiteMutation } from "@/lib/request-security";
import { putStoredFile } from "@/lib/render-storage";

const allowedExtensions = new Set(["pdf", "docx", "txt", "md", "html", "htm", "rtf"]);
const maximumBytes = 25 * 1024 * 1024;

export async function POST(request: Request) {
  const origin = rejectCrossSiteMutation(request);
  if (origin) return origin;
  const account = await requireActiveProfile(["facilitator", "admin"]);
  if (account.error || !account.profile) return account.error;

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Choose a searchable PDF, DOCX, TXT, Markdown, HTML or RTF learning manual." }, { status: 400 });
  }
  if (file.size > maximumBytes) {
    return Response.json({ error: "Learning manuals must be 25 MB or smaller." }, { status: 413 });
  }

  const extension = file.name.toLowerCase().split(".").pop() ?? "";
  if (!allowedExtensions.has(extension)) {
    return Response.json({ error: "Use a searchable PDF, DOCX, TXT, Markdown, HTML or RTF manual. Save legacy .doc files as .docx first." }, { status: 415 });
  }

  try {
    const body = Buffer.from(await file.arrayBuffer());
    const mimeType = extension === "pdf" ? "application/pdf" : file.type || "application/octet-stream";
    const extracted = extractReadableContent(body, file.name, mimeType);
    if (extracted.text.trim().length < 200 || extracted.wordCount < 35) {
      return Response.json({
        error: "This manual did not expose enough readable text. Upload a searchable PDF or DOCX. Run OCR first for a scanned PDF.",
        conversionNote: extracted.note,
      }, { status: 422 });
    }

    const storedFile = new File([body], file.name, { type: mimeType });
    const fileKey = await putStoredFile("course-manuals", storedFile, {
      contentType: mimeType,
      originalName: file.name,
      ownerEmail: account.profile.email,
      evidenceKind: "course-manual-source",
    });
    const proposal = buildManualCourseProposal({
      fileName: file.name,
      fileKey,
      mimeType,
      readableHtml: extracted.html,
      plainText: extracted.text,
      conversionNote: extracted.note,
    });
    await recordAudit(account.profile.email, "course.manual_imported", {
      fileName: file.name,
      wordCount: extracted.wordCount,
      sections: proposal.counts.sections,
    });
    return Response.json({ proposal }, { status: 201 });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : "The learning manual could not be converted into a course draft.",
    }, { status: 422 });
  }
}
