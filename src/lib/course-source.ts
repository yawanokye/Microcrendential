import { extractReadableContent, textToReadableHtml } from "./document-content";
export type SourceSpan = { label: string; start: number; end: number; page?: number; slide?: number; timestampSeconds?: number };
export type SourceReference = { label: string; page?: number; slide?: number; timestampSeconds?: number };
export function sourceReferences(excerpt: string, text: string, spans: SourceSpan[]): SourceReference[] {
  if (!excerpt) return [];
  const start = text.indexOf(excerpt); if (start < 0) return [];
  return spans.filter(s => s.start < start + excerpt.length && s.end > start).map(({ label, page, slide, timestampSeconds }) => ({ label, page, slide, timestampSeconds })).slice(0, 5);
}
export function transcriptSpans(text: string): SourceSpan[] {
  const matches = [...text.matchAll(/^(?:\[)?((?:\d{1,2}:)?\d{1,2}:\d{2})(?:\])?\s+/gm)];
  return matches.map((m, i) => { const parts = m[1].split(":").map(Number); const seconds = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1]; return { label: `Transcript ${m[1]}`, timestampSeconds: seconds, start: m.index!, end: matches[i + 1]?.index ?? text.length }; }).filter(s => Number.isFinite(s.timestampSeconds));
}
export function sourceChunks(text: string): SourceSpan[] {
  const chunks: SourceSpan[] = []; for (let start = 0; start < text.length; start += 12000) chunks.push({ label: `Source characters ${start + 1}–${Math.min(text.length, start + 12000)}`, start, end: Math.min(text.length, start + 12000) }); return chunks;
}
/** Select complete source spans using the approved section's terms. No positional outcome mapping. */
export function selectSectionSource(text: string, spans: SourceSpan[], topic: string) {
  const units = spans.length ? spans : sourceChunks(text), words = [...new Set(topic.toLowerCase().match(/[a-z]{4,}/g) || [])].filter(w => !["course", "section", "learning", "outcome", "understand"].includes(w));
  const ranked = units.map(s => ({ span: s, score: words.reduce((n, w) => n + (text.slice(s.start, s.end).toLowerCase().split(w).length - 1), 0) })).sort((a, b) => b.score - a.score || a.span.start - b.span.start);
  const selected: SourceSpan[] = []; let length = 0;
  for (const unit of ranked) { const span = { ...unit.span, end: Math.min(unit.span.end, unit.span.start + 88000) }; if (selected.length && length + span.end - span.start > 88000) continue; selected.push(span); length += span.end - span.start; if (selected.length >= 8 || length >= 80000) break; }
  selected.sort((a, b) => a.start - b.start); let combined = ""; const mapped: SourceSpan[] = [];
  for (const span of selected) { if (combined) combined += "\n\n"; const start = combined.length; combined += text.slice(span.start, span.end); mapped.push({ ...span, start, end: combined.length }); }
  return { text: combined, spans: mapped, originalRanges: selected.map(({ start, end }) => ({ start, end })), weakMatch: words.length > 0 && (ranked[0]?.score || 0) === 0 };
}
export async function extractCourseSource(buffer: Buffer, name: string, mimeType: string) {
  if (mimeType !== "application/pdf" && !name.toLowerCase().endsWith(".pdf")) {
    const result = extractReadableContent(buffer, name, mimeType); const spans = name.toLowerCase().endsWith(".pptx") ? sourceChunks(result.text) : transcriptSpans(result.text);
    return { ...result, spans, totalPages: undefined as number | undefined, extractionLimited: false };
  }
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data: new Uint8Array(buffer), disableFontFace: true, useSystemFonts: true });
  let text = ""; const spans: SourceSpan[] = []; let totalPages = 0, limited = false;
  try {
    const doc = await task.promise; totalPages = doc.numPages;
    for (let page = 1; page <= Math.min(totalPages, 400); page++) {
      const value = await doc.getPage(page), content = await value.getTextContent();
      const pageText = content.items.map(i => "str" in i ? i.str + (i.hasEOL ? "\n" : " ") : "").join("").replace(/[ \t]+/g, " ").trim(); value.cleanup();
      if (text) text += "\n\n"; const start = text.length; text += pageText; spans.push({ label: `PDF page ${page}`, page, start, end: text.length });
      if (text.length >= 600000) { limited = page < totalPages; break; }
    }
    limited ||= totalPages > 400;
  } finally { await task.destroy(); }
  return { text, html: textToReadableHtml(text), wordCount: text.split(/\s+/).filter(Boolean).length, note: limited ? "PDF text extraction stopped at the safety limit. Split the manual to analyse the remaining pages." : "PDF text extracted in page order. Source references identify actual PDF page numbers.", spans, totalPages, extractionLimited: limited };
}
