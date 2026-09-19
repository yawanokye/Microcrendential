import { textToReadableHtml } from "@/lib/document-content";

const MAX_AI_FILE_BYTES = 25 * 1024 * 1024;
const MAX_EXTRACTED_CHARS = 300_000;

function mimeFor(fileName: string, supplied = "") {
  if (supplied) return supplied;
  const extension = fileName.toLowerCase().split(".").pop() ?? "";
  if (extension === "pdf") return "application/pdf";
  if (extension === "pptx") return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  if (extension === "ppt") return "application/vnd.ms-powerpoint";
  if (extension === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return "application/octet-stream";
}

function outputText(payload: unknown) {
  const response = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  if (typeof response.output_text === "string") return response.output_text;
  const output = Array.isArray(response.output) ? response.output : [];
  return output.flatMap((item) => {
    const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const content = Array.isArray(record.content) ? record.content : [];
    return content.map((part) => {
      const value = part && typeof part === "object" ? part as Record<string, unknown> : {};
      return typeof value.text === "string" ? value.text : "";
    });
  }).filter(Boolean).join("\n");
}

export async function extractScannedDocumentWithAi(buffer: Buffer, fileName: string, suppliedMimeType = "") {
  if (buffer.length > MAX_AI_FILE_BYTES) throw new Error("AI document extraction supports files up to 25 MB.");
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("This document needs AI extraction, but OPENAI_API_KEY is not configured.");
  const mimeType = mimeFor(fileName, suppliedMimeType);
  const model = process.env.OPENAI_DOCUMENT_MODEL?.trim() || process.env.OPENAI_GRADING_LUNA_MODEL?.trim() || "gpt-5.6-luna";
  const extension = fileName.toLowerCase().split(".").pop() ?? "";
  const filePart: Record<string, unknown> = {
    type: "input_file",
    filename: fileName.slice(0, 240),
    file_data: `data:${mimeType};base64,${buffer.toString("base64")}`,
  };
  if (extension === "pdf") filePart.detail = "high";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      store: false,
      max_output_tokens: 16_000,
      input: [{
        role: "user",
        content: [
          filePart,
          {
            type: "input_text",
            text: "Extract the complete readable educational content from this file. The file may be a scanned PDF or a PowerPoint presentation containing text inside images. Preserve the reading order. Preserve slide/page headings and meaningful table content. Describe educational diagrams briefly only when their labels or meaning are needed to understand the lesson. Do not summarise, grade, rewrite or add new content. Return plain text only. Use lines beginning with # for major headings and ## for slide/page subheadings when identifiable.",
          },
        ],
      }],
    }),
  });
  const payload = await response.json() as unknown;
  if (!response.ok) {
    const record = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
    const error = record.error && typeof record.error === "object" ? record.error as Record<string, unknown> : {};
    throw new Error(typeof error.message === "string" ? error.message : "AI document extraction failed.");
  }
  const text = outputText(payload).replace(/\r\n?/g, "\n").trim().slice(0, MAX_EXTRACTED_CHARS);
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (text.length < 80 || wordCount < 15) throw new Error("AI extraction did not return enough readable content from this file.");
  return {
    text,
    html: textToReadableHtml(text),
    wordCount,
    note: `Readable content was extracted with ${model} because the source was scanned, image-based or not reliably machine-readable. Review it against the original before publishing.`,
    model,
  };
}
