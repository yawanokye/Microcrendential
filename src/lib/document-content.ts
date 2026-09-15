import { inflateRawSync, inflateSync } from "node:zlib";

const MAX_READABLE_CHARACTERS = 300_000;
const allowedTags = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote", "pre", "code", "strong", "b", "em", "i", "u", "br", "hr", "table", "thead", "tbody", "tr", "th", "td", "a"]);

export const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");

const decodeEntities = (value: string) => value
  .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
  .replaceAll("&nbsp;", " ")
  .replaceAll("&amp;", "&")
  .replaceAll("&lt;", "<")
  .replaceAll("&gt;", ">")
  .replaceAll("&quot;", '"')
  .replaceAll("&apos;", "'");

export function sanitizeReadableHtml(value: string) {
  const withoutUnsafeBlocks = value
    .replace(/<!--([\s\S]*?)-->/g, "")
    .replace(/<\s*(script|style|iframe|object|embed|form|svg|math|canvas|template)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|style|iframe|object|embed|form|svg|math|canvas|template)[^>]*\/?>/gi, "");
  return withoutUnsafeBlocks.replace(/<\/?([a-z0-9-]+)(?:\s[^>]*)?>/gi, (tag, rawName: string) => {
    const name = rawName.toLowerCase();
    if (!allowedTags.has(name)) return "";
    if (/^<\s*\//.test(tag)) return `</${name}>`;
    if (name === "br" || name === "hr") return `<${name}>`;
    if (name === "a") {
      const hrefMatch = tag.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const href = decodeEntities(hrefMatch?.[1] || hrefMatch?.[2] || hrefMatch?.[3] || "").trim();
      if (/^https?:\/\//i.test(href)) return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">`;
      return "<a>";
    }
    return `<${name}>`;
  }).slice(0, MAX_READABLE_CHARACTERS);
}

export function plainTextFromHtml(value: string) {
  return decodeEntities(value
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h1|h2|h3|h4|h5|h6|li|blockquote|pre|tr)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_READABLE_CHARACTERS);
}

const inlineMarkup = (value: string) => escapeHtml(value)
  .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  .replace(/_([^_]+)_/g, "<em>$1</em>")
  .replace(/`([^`]+)`/g, "<code>$1</code>");

export function textToReadableHtml(value: string) {
  const text = value.replace(/\r\n?/g, "\n").trim().slice(0, MAX_READABLE_CHARACTERS);
  if (!text) return "";
  const lines = text.split("\n");
  const html: string[] = [];
  let list: "ul" | "ol" | null = null;
  const closeList = () => { if (list) html.push(`</${list}>`); list = null; };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { closeList(); continue; }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) { closeList(); html.push(`<h${heading[1].length}>${inlineMarkup(heading[2])}</h${heading[1].length}>`); continue; }
    const unordered = line.match(/^[-*•]\s+(.+)$/);
    if (unordered) { if (list !== "ul") { closeList(); list = "ul"; html.push("<ul>"); } html.push(`<li>${inlineMarkup(unordered[1])}</li>`); continue; }
    const ordered = line.match(/^\d+[.)]\s+(.+)$/);
    if (ordered) { if (list !== "ol") { closeList(); list = "ol"; html.push("<ol>"); } html.push(`<li>${inlineMarkup(ordered[1])}</li>`); continue; }
    closeList();
    if (/^[A-Z][^.!?]{2,80}:$/.test(line)) html.push(`<h3>${inlineMarkup(line.slice(0, -1))}</h3>`);
    else html.push(`<p>${inlineMarkup(line)}</p>`);
  }
  closeList();
  return html.join("");
}

function findZipEntry(archive: Buffer, wantedName: string) {
  let eocd = -1;
  for (let index = archive.length - 22; index >= Math.max(0, archive.length - 65_557); index -= 1) {
    if (archive.readUInt32LE(index) === 0x06054b50) { eocd = index; break; }
  }
  if (eocd < 0) throw new Error("The DOCX archive is not readable.");
  const totalEntries = archive.readUInt16LE(eocd + 10);
  let cursor = archive.readUInt32LE(eocd + 16);
  for (let entryIndex = 0; entryIndex < totalEntries; entryIndex += 1) {
    if (archive.readUInt32LE(cursor) !== 0x02014b50) throw new Error("The DOCX directory is damaged.");
    const method = archive.readUInt16LE(cursor + 10);
    const compressedSize = archive.readUInt32LE(cursor + 20);
    const fileNameLength = archive.readUInt16LE(cursor + 28);
    const extraLength = archive.readUInt16LE(cursor + 30);
    const commentLength = archive.readUInt16LE(cursor + 32);
    const localOffset = archive.readUInt32LE(cursor + 42);
    const fileName = archive.subarray(cursor + 46, cursor + 46 + fileNameLength).toString("utf8");
    if (fileName === wantedName) {
      if (archive.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("The DOCX entry is damaged.");
      const localNameLength = archive.readUInt16LE(localOffset + 26);
      const localExtraLength = archive.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = archive.subarray(start, start + compressedSize);
      if (method === 0) return compressed;
      if (method === 8) return inflateRawSync(compressed);
      throw new Error("This DOCX compression method is not supported.");
    }
    cursor += 46 + fileNameLength + extraLength + commentLength;
  }
  throw new Error("The DOCX file does not contain a readable document body.");
}

function docxToReadableHtml(buffer: Buffer) {
  const xml = findZipEntry(buffer, "word/document.xml").toString("utf8");
  const blocks: string[] = [];
  const paragraphPattern = /<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g;
  for (const match of xml.matchAll(paragraphPattern)) {
    const body = match[1];
    const text = decodeEntities(Array.from(body.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)).map((item) => item[1]).join(""))
      .replace(/\s+/g, " ").trim();
    if (!text) continue;
    const headingMatch = body.match(/<w:pStyle[^>]*w:val="(?:Heading|heading)([1-6])"/);
    const isList = /<w:numPr[\s>]/.test(body);
    if (headingMatch) blocks.push(`<h${headingMatch[1]}>${escapeHtml(text)}</h${headingMatch[1]}>`);
    else if (isList) blocks.push(`<ul><li>${escapeHtml(text)}</li></ul>`);
    else blocks.push(`<p>${escapeHtml(text)}</p>`);
  }
  return blocks.join("").replace(/<\/ul><ul>/g, "");
}

function decodePdfLiteral(value: string) {
  let output = "";
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character !== "\\") { output += character; continue; }
    const next = value[++index] ?? "";
    if (/[0-7]/.test(next)) {
      let octal = next;
      while (octal.length < 3 && /[0-7]/.test(value[index + 1] ?? "")) octal += value[++index];
      output += String.fromCharCode(Number.parseInt(octal, 8));
    } else if (next === "n") output += "\n";
    else if (next === "r") output += "\r";
    else if (next === "t") output += "\t";
    else if (next === "b") output += "\b";
    else if (next === "f") output += "\f";
    else if (next !== "\n" && next !== "\r") output += next;
  }
  return output;
}

function stringsFromPdfOperators(value: string) {
  const text: string[] = [];
  for (const block of value.matchAll(/BT([\s\S]*?)ET/g)) {
    const content = block[1];
    for (const token of content.matchAll(/\(((?:\\.|[^\\)])*)\)|<([0-9A-Fa-f\s]{2,})>/g)) {
      if (token[1] !== undefined) text.push(decodePdfLiteral(token[1]));
      else if (token[2]) {
        const hex = token[2].replace(/\s+/g, "");
        try {
          const bytes = Buffer.from(hex.length % 2 ? `${hex}0` : hex, "hex");
          const decoded = bytes.length >= 2 && (bytes[0] === 0xfe && bytes[1] === 0xff)
            ? Array.from({ length: Math.floor((bytes.length - 2) / 2) }, (_, index) => String.fromCharCode(bytes.readUInt16BE(2 + index * 2))).join("")
            : bytes.toString("utf8");
          text.push(decoded);
        } catch { /* Ignore malformed text operands. */ }
      }
    }
    text.push("\n");
  }
  return text.join(" ").replace(/\u0000/g, "").replace(/[ \t]+/g, " ").replace(/\n\s+/g, "\n");
}

function pdfToText(buffer: Buffer) {
  const raw = buffer.toString("latin1");
  const sources = [raw];
  const streamPattern = /<<(.*?)>>\s*stream\r?\n/g;
  for (const match of raw.matchAll(streamPattern)) {
    const start = (match.index ?? 0) + match[0].length;
    const end = raw.indexOf("endstream", start);
    if (end < 0 || end - start > 20 * 1024 * 1024) continue;
    let data = buffer.subarray(start, end);
    if (data.at(-1) === 10) data = data.subarray(0, -1);
    if (data.at(-1) === 13) data = data.subarray(0, -1);
    try {
      if (/\/FlateDecode/.test(match[1])) data = inflateSync(data);
      sources.push(data.toString("latin1"));
    } catch { /* Some streams contain images or unsupported filters. */ }
  }
  return sources.map(stringsFromPdfOperators).join("\n").replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFF]/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function hasPlausiblePdfText(value: string) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length < 80 || text.startsWith("%PDF-")) return false;
  const tokens = text.split(" ").filter(Boolean);
  const naturalWords = tokens.filter((token) => {
    const letters = Array.from(token).filter((character) => /\p{L}/u.test(character));
    return letters.length >= 2 && letters.length / Math.max(1, Array.from(token).length) >= 0.65;
  });
  const noisySymbols = Array.from(text).filter((character) => /[¤¦¨©ª«¬®¯°±²³´µ¶·¸¹º»¼½¾¿×÷�]/.test(character)).length;
  const mojibakeMarkers = (text.match(/[ÃÂÐÑØÞðþÿ]/g) ?? []).length;
  return naturalWords.length / Math.max(1, tokens.length) >= 0.55
    && noisySymbols / text.length < 0.02
    && mojibakeMarkers / text.length < 0.015;
}

function rtfToText(value: string) {
  return value
    .replace(/\\par[d]?\b/g, "\n")
    .replace(/\\'[0-9a-f]{2}/gi, (match) => String.fromCharCode(Number.parseInt(match.slice(2), 16)))
    .replace(/\\[a-z]+-?\d*\s?/gi, "")
    .replace(/[{}]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractReadableContent(buffer: Buffer, fileName: string, mimeType = "") {
  const extension = fileName.toLowerCase().split(".").pop() ?? "";
  let html = "";
  let note = "Readable text generated from the supplied source.";
  if (extension === "docx" || mimeType.includes("wordprocessingml")) html = docxToReadableHtml(buffer);
  else if (extension === "pdf" || mimeType === "application/pdf") {
    const text = pdfToText(buffer);
    if (hasPlausiblePdfText(text)) {
      html = textToReadableHtml(text);
      note = "Readable text was extracted from the PDF. The original-layout PDF remains available in the protected learner viewer.";
    } else {
      html = "";
      note = "The PDF uses a scanned or encoded layout, so it will open in the protected original-layout viewer instead of showing unreliable extracted text.";
    }
  } else if (extension === "html" || extension === "htm" || mimeType.includes("text/html")) html = sanitizeReadableHtml(buffer.toString("utf8"));
  else if (extension === "rtf" || mimeType.includes("rtf")) html = textToReadableHtml(rtfToText(buffer.toString("latin1")));
  else html = textToReadableHtml(buffer.toString("utf8"));
  html = sanitizeReadableHtml(html);
  const text = plainTextFromHtml(html);
  return { html, text, wordCount: text.split(/\s+/).filter(Boolean).length, note };
}

export function extractArticleHtml(value: string) {
  const source = value.replace(/<\s*(script|style|noscript|svg|form|nav|footer|aside)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "");
  const article = source.match(/<article(?:\s[^>]*)?>([\s\S]*?)<\/article>/i)?.[1]
    || source.match(/<main(?:\s[^>]*)?>([\s\S]*?)<\/main>/i)?.[1]
    || source.match(/<body(?:\s[^>]*)?>([\s\S]*?)<\/body>/i)?.[1]
    || source;
  const html = sanitizeReadableHtml(article);
  const text = plainTextFromHtml(html);
  return { html, text, wordCount: text.split(/\s+/).filter(Boolean).length, note: "Readable text imported from the linked public page. Review accuracy, licence and attribution before publishing." };
}
