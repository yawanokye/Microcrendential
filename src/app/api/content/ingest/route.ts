import { requireActiveProfile } from "@/lib/accounts";
import type { CourseMaterialRecord } from "@/lib/course-design";
import { extractArticleHtml, extractReadableContent, plainTextFromHtml, sanitizeReadableHtml, textToReadableHtml } from "@/lib/document-content";
import { fetchPublicResource, validatePublicHttpUrl } from "@/lib/public-url";
import { putStoredFile } from "@/lib/render-storage";

const allowedExtensions = new Set(["pdf", "doc", "docx", "txt", "md", "html", "htm", "rtf", "ppt", "pptx", "csv", "jpg", "jpeg", "png", "webp", "mp3", "wav", "mp4", "webm"]);
const convertibleExtensions = new Set(["pdf", "docx", "txt", "md", "html", "htm", "rtf"]);

const clean = (form: FormData, key: string, maximum = 500) => String(form.get(key) ?? "").trim().slice(0, maximum);
const placement = (form: FormData) => ({
  sectionId: clean(form, "sectionId", 80) || "section-1",
  sectionTitle: clean(form, "sectionTitle", 200) || "Course content",
  unitTitle: clean(form, "unitTitle", 200) || "Learning unit",
  outcomeIds: clean(form, "outcomeIds", 2000).split(",").map((item) => item.trim()).filter(Boolean).slice(0, 20),
});

const titleFromUrl = (url: URL) => url.pathname.split("/").filter(Boolean).at(-1)?.replace(/[-_]/g, " ") || url.hostname;

export async function POST(request: Request) {
  const account = await requireActiveProfile(["facilitator", "admin"]);
  if (account.error || !account.profile) return account.error;
  const form = await request.formData(); const mode = clean(form, "mode", 30); const location = placement(form);
  const requestedTitle = clean(form, "title", 240); const sourceLabel = clean(form, "source", 240) || "Course author";
  let material: CourseMaterialRecord;

  if (mode === "text") {
    const input = String(form.get("text") ?? "").trim();
    if (input.length < 20) return Response.json({ error: "Enter at least 20 characters of learning content." }, { status: 400 });
    const inputFormat = clean(form, "inputFormat", 20);
    const readableHtml = inputFormat === "html" ? sanitizeReadableHtml(input) : textToReadableHtml(input);
    const plainText = plainTextFromHtml(readableHtml);
    material = { id: crypto.randomUUID(), title: requestedTitle || "Readable lesson", kind: "Read", source: sourceLabel, readableHtml, plainText, estimatedMinutes: Math.max(1, Math.ceil(plainText.split(/\s+/).filter(Boolean).length / 200)), accessibilityChecked: true, license: clean(form, "license", 200) || "Course-authored content", ...location };
  } else if (mode === "file") {
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "Choose a course document or media file." }, { status: 400 });
    if (file.size > 25 * 1024 * 1024) return Response.json({ error: "Course content files must be 25 MB or smaller." }, { status: 413 });
    const extension = file.name.toLowerCase().split(".").pop() ?? "";
    if (!allowedExtensions.has(extension)) return Response.json({ error: "Use PDF, DOCX, text, HTML, RTF, PowerPoint, CSV, image, audio or video content." }, { status: 415 });
    const mimeType = extension === "pdf" ? "application/pdf" : file.type || "application/octet-stream";
    const fileKey = await putStoredFile("course-materials", file, { contentType: mimeType, originalName: file.name, ownerEmail: account.profile.email, evidenceKind: "course-material" });
    let readableHtml = ""; let plainText = ""; let note = "The original file is available to authorised course learners.";
    if (convertibleExtensions.has(extension)) {
      try { const extracted = extractReadableContent(Buffer.from(await file.arrayBuffer()), file.name, file.type); readableHtml = extracted.html; plainText = extracted.text; note = extracted.note; }
      catch (reason) { note = reason instanceof Error ? reason.message : "Automatic readable-text conversion was not available for this document."; }
    }
    const kind = extension === "pdf" || readableHtml ? "Read" : file.type.startsWith("video/") || file.type.startsWith("audio/") ? "Watch" : "Download";
    material = { id: crypto.randomUUID(), title: requestedTitle || file.name.replace(/\.[^.]+$/, ""), kind, source: sourceLabel, fileKey, fileName: file.name, mimeType, readableHtml: readableHtml || undefined, plainText: plainText || undefined, estimatedMinutes: Math.max(1, Math.ceil((plainText.split(/\s+/).filter(Boolean).length || 200) / 200)), accessibilityChecked: plainText.length >= 80, license: clean(form, "license", 200) || "Institution-supplied learning material", ...location };
    return Response.json({ material, conversionNote: note }, { status: 201 });
  } else if (mode === "url") {
    const rawUrl = clean(form, "url", 3000); if (!rawUrl) return Response.json({ error: "Paste a public learning-resource link." }, { status: 400 });
    try {
      const url = await validatePublicHttpUrl(rawUrl); const embedOnly = clean(form, "embedOnly", 10) === "true";
      if (embedOnly) {
        material = { id: crypto.randomUUID(), title: requestedTitle || titleFromUrl(url), kind: "Embed", source: sourceLabel || url.hostname, url: url.toString(), externalUrl: url.toString(), estimatedMinutes: 10, accessibilityChecked: false, license: clean(form, "license", 200) || "Licence review required", ...location };
      } else {
        const resource = await fetchPublicResource(url.toString());
        const inferredName = new URL(resource.finalUrl).pathname.split("/").filter(Boolean).at(-1) || "linked-resource";
        const extracted = resource.contentType.includes("html") ? extractArticleHtml(resource.body.toString("utf8")) : extractReadableContent(resource.body, inferredName, resource.contentType);
        if (extracted.text.length < 40) return Response.json({ error: "The linked page did not expose enough readable text. Add it as an external embed or supply a document instead." }, { status: 422 });
        material = { id: crypto.randomUUID(), title: requestedTitle || titleFromUrl(new URL(resource.finalUrl)), kind: "Read", source: sourceLabel || new URL(resource.finalUrl).hostname, url: resource.finalUrl, externalUrl: resource.finalUrl, readableHtml: extracted.html, plainText: extracted.text, estimatedMinutes: Math.max(1, Math.ceil(extracted.wordCount / 200)), accessibilityChecked: true, license: clean(form, "license", 200) || "Licence and attribution review required", ...location };
        return Response.json({ material, conversionNote: extracted.note }, { status: 201 });
      }
    } catch (reason) { return Response.json({ error: reason instanceof Error ? reason.message : "The linked resource could not be imported." }, { status: 422 }); }
  } else return Response.json({ error: "Choose text, file or link content." }, { status: 400 });

  return Response.json({ material }, { status: 201 });
}
