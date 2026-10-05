import { readFile } from "node:fs/promises";
import { join } from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import sharp from "sharp";
import {
  certificateAchievementStatement,
  certificateConfigurationFromSnapshot,
  certificateEyebrow,
  certificatePartnershipStatement,
  certificateTitle,
} from "@/lib/certificate-policy";
import { makeVerificationQr } from "@/lib/qr-code";
import { getStoredFile } from "@/lib/render-storage";

export type CertificatePdfRecord = {
  certificate_code: string;
  learner_name: string;
  course_code: string;
  course_title: string;
  credential_type: string;
  issued_at: string;
  expires_at: string | null;
  award_type: string;
  issuance_model: string;
  partner_name: string | null;
  partner_logo_key: string | null;
  partner_signatory_name: string | null;
  partner_signatory_title: string | null;
  partner_signature_key: string | null;
  cpd_hours: number;
  cpd_points: number;
  professional_approval_body: string | null;
  professional_approval_reference: string | null;
  show_academic_lead: number;
  facilitator_name: string | null;
  facilitator_title: string | null;
  facilitator_signature_key: string | null;
  provost_name: string | null;
  provost_title: string | null;
  provost_signature_key: string | null;
};

type Signature = { name: string; title: string; key?: string | null };

const navy = rgb(24 / 255, 32 / 255, 95 / 255);
const uccBlue = rgb(46 / 255, 48 / 255, 148 / 255);
const gold = rgb(242 / 255, 212 / 255, 0);
const red = rgb(237 / 255, 27 / 255, 36 / 255);
const muted = rgb(82 / 255, 92 / 255, 122 / 255);
const white = rgb(1, 1, 1);

function fitText(text: string, font: PDFFont, preferred: number, maximumWidth: number, minimum = 10) {
  let size = preferred;
  while (size > minimum && font.widthOfTextAtSize(text, size) > maximumWidth) size -= 0.5;
  return size;
}

function wrapText(text: string, font: PDFFont, size: number, maximumWidth: number, maximumLines = 2) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || font.widthOfTextAtSize(candidate, size) <= maximumWidth) current = candidate;
    else { lines.push(current); current = word; }
  }
  if (current) lines.push(current);
  if (lines.length <= maximumLines) return lines;
  const visible = lines.slice(0, maximumLines);
  visible[maximumLines - 1] = `${visible[maximumLines - 1]} ${lines.slice(maximumLines).join(" ")}`;
  while (font.widthOfTextAtSize(`${visible[maximumLines - 1]}…`, size) > maximumWidth && visible[maximumLines - 1].length > 1) {
    visible[maximumLines - 1] = visible[maximumLines - 1].slice(0, -1).trimEnd();
  }
  visible[maximumLines - 1] += "…";
  return visible;
}

function drawCentered(page: PDFPage, text: string, font: PDFFont, size: number, y: number, colour = navy) {
  page.drawText(text, { x: (page.getWidth() - font.widthOfTextAtSize(text, size)) / 2, y, size, font, color: colour });
}

function drawCenteredLines(page: PDFPage, lines: string[], font: PDFFont, size: number, y: number, lineHeight: number, colour = navy) {
  lines.forEach((line, index) => drawCentered(page, line, font, size, y - index * lineHeight, colour));
}

function drawImageContain(page: PDFPage, image: PDFImage, x: number, y: number, width: number, height: number) {
  const scale = Math.min(width / image.width, height / image.height);
  const actualWidth = image.width * scale;
  const actualHeight = image.height * scale;
  page.drawImage(image, { x: x + (width - actualWidth) / 2, y: y + (height - actualHeight) / 2, width: actualWidth, height: actualHeight });
}

async function embedImage(document: PDFDocument, bytes: Uint8Array, contentType: string) {
  if (contentType === "image/png") return document.embedPng(bytes);
  if (contentType === "image/jpeg") return document.embedJpg(bytes);
  const png = await sharp(bytes).png().toBuffer();
  return document.embedPng(png);
}

async function storedImage(document: PDFDocument, key?: string | null) {
  if (!key) return null;
  try {
    const stored = await getStoredFile(key);
    return await embedImage(document, stored.body, stored.metadata.contentType);
  } catch {
    return null;
  }
}

function drawQr(page: PDFPage, value: string, x: number, y: number, size: number) {
  const matrix = makeVerificationQr(value);
  const quiet = 4;
  const cell = size / (matrix.length + quiet * 2);
  page.drawRectangle({ x, y, width: size, height: size, color: white, borderColor: uccBlue, borderWidth: 0.7 });
  matrix.forEach((row, rowIndex) => row.forEach((dark, columnIndex) => {
    if (dark) page.drawRectangle({ x: x + (columnIndex + quiet) * cell, y: y + size - (rowIndex + quiet + 1) * cell, width: cell + 0.05, height: cell + 0.05, color: navy });
  }));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

export async function createCertificatePdf(certificate: CertificatePdfRecord, verificationUrl: string) {
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const page = document.addPage([841.89, 595.28]);
  const fontRoot = join(process.cwd(), "public", "fonts");
  const [sansBytes, sansBoldBytes, serifBytes, serifBoldBytes, crestBytes] = await Promise.all([
    readFile(join(fontRoot, "DejaVuSans.ttf")),
    readFile(join(fontRoot, "DejaVuSans-Bold.ttf")),
    readFile(join(fontRoot, "DejaVuSerif.ttf")),
    readFile(join(fontRoot, "DejaVuSerif-Bold.ttf")),
    readFile(join(process.cwd(), "public", "ucc_crest_approved_2026.png")),
  ]);
  const [regular, bold, times, timesBold] = await Promise.all([
    document.embedFont(sansBytes, { subset: true }),
    document.embedFont(sansBoldBytes, { subset: true }),
    document.embedFont(serifBytes, { subset: true }),
    document.embedFont(serifBoldBytes, { subset: true }),
  ]);
  const timesItalicBold = timesBold;
  const configuration = certificateConfigurationFromSnapshot(certificate);
  const partnerIssued = configuration.issuanceModel === "partner_issued";
  const crest = await document.embedPng(crestBytes);
  const [partnerLogo, provostSignature, partnerSignature, facilitatorSignature] = await Promise.all([
    storedImage(document, certificate.partner_logo_key),
    storedImage(document, certificate.provost_signature_key),
    storedImage(document, certificate.partner_signature_key),
    storedImage(document, certificate.facilitator_signature_key),
  ]);

  page.drawRectangle({ x: 0, y: 0, width: page.getWidth(), height: page.getHeight(), color: rgb(1, 0.998, 0.988) });
  page.drawRectangle({ x: 18, y: 18, width: page.getWidth() - 36, height: page.getHeight() - 36, borderColor: uccBlue, borderWidth: 3 });
  page.drawRectangle({ x: 31, y: 31, width: page.getWidth() - 62, height: page.getHeight() - 62, borderColor: gold, borderWidth: 1.4 });

  if (partnerIssued) {
    if (partnerLogo) drawImageContain(page, partnerLogo, 52, 486, 120, 62);
    page.drawText(configuration.partnerName || "Partner Institution", { x: partnerLogo ? 184 : 52, y: 518, size: fitText(configuration.partnerName || "Partner Institution", timesBold, 22, 410), font: timesBold, color: uccBlue });
    page.drawText("ISSUING INSTITUTION", { x: partnerLogo ? 184 : 52, y: 497, size: 8, font: bold, color: red });
    drawImageContain(page, crest, 702, 502, 42, 42);
    page.drawText("DELIVERED THROUGH", { x: 750, y: 530, size: 6.5, font: bold, color: muted });
    page.drawText("UCC GROWTH+", { x: 750, y: 514, size: 10, font: bold, color: uccBlue });
  } else {
    drawImageContain(page, crest, 52, 479, 68, 68);
    page.drawText("UNIVERSITY OF CAPE COAST", { x: 132, y: 520, size: 22, font: timesBold, color: uccBlue });
    page.drawText("UCC GROWTH+ · LIFELONG LEARNING", { x: 132, y: 495, size: 8, font: bold, color: red });
    if (partnerLogo && configuration.issuanceModel !== "ucc_sponsored") {
      page.drawText(configuration.issuanceModel === "jointly_issued" ? "JOINTLY ISSUED WITH" : "IN PARTNERSHIP WITH", { x: 653, y: 535, size: 6.5, font: bold, color: muted });
      drawImageContain(page, partnerLogo, 648, 477, 140, 52);
    }
  }

  const eyebrow = certificateEyebrow(configuration.awardType, certificate.credential_type === "stacked_credential");
  drawCentered(page, eyebrow, bold, 8.5, 461, uccBlue);
  const title = certificateTitle(configuration.awardType);
  drawCentered(page, title, timesBold, fitText(title, timesBold, 34, 700, 25), 420, navy);
  page.drawLine({ start: { x: 370, y: 402 }, end: { x: 472, y: 402 }, thickness: 3.5, color: gold });
  drawCentered(page, "This certificate is presented to", times, 13, 377, muted);
  const learnerSize = fitText(certificate.learner_name, timesItalicBold, 30, 690, 21);
  drawCentered(page, certificate.learner_name, timesItalicBold, learnerSize, 341, uccBlue);
  drawCentered(page, certificateAchievementStatement(configuration.awardType), times, 12, 315, muted);
  let courseSize = 21;
  let courseLines = wrapText(certificate.course_title, timesBold, courseSize, 690, 2);
  while (courseLines.some((line) => timesBold.widthOfTextAtSize(line, courseSize) > 690) && courseSize > 14) {
    courseSize -= 0.5;
    courseLines = wrapText(certificate.course_title, timesBold, courseSize, 690, 2);
  }
  drawCenteredLines(page, courseLines, timesBold, courseSize, 280, courseSize + 3, uccBlue);
  const partnershipY = courseLines.length === 2 ? 226 : 245;
  drawCentered(page, certificatePartnershipStatement(configuration), bold, fitText(certificatePartnershipStatement(configuration), bold, 8.5, 680, 7), partnershipY, muted);
  if (configuration.cpdHours > 0) {
    const detail = `${configuration.cpdHours} CPD hour${configuration.cpdHours === 1 ? "" : "s"}${configuration.cpdPoints > 0 ? `  ·  ${configuration.cpdPoints} approved CPD point${configuration.cpdPoints === 1 ? "" : "s"}` : ""}`;
    drawCentered(page, detail, bold, 8.5, partnershipY - 19, uccBlue);
  }

  const signatures: Signature[] = [];
  if (!partnerIssued) signatures.push({ name: certificate.provost_name || "Authorised University Signatory", title: certificate.provost_title || "University of Cape Coast", key: certificate.provost_signature_key });
  if (configuration.partnerSignatoryName) signatures.push({ name: configuration.partnerSignatoryName, title: configuration.partnerSignatoryTitle || "Authorised Partner Signatory", key: certificate.partner_signature_key });
  if (certificate.show_academic_lead && !["jointly_issued", "partner_issued"].includes(configuration.issuanceModel)) signatures.push({ name: certificate.facilitator_name || "Course Academic Lead", title: certificate.facilitator_title || "Academic Lead", key: certificate.facilitator_signature_key });
  const signatureImages = new Map<string, PDFImage | null>([
    [certificate.provost_signature_key || "", provostSignature],
    [certificate.partner_signature_key || "", partnerSignature],
    [certificate.facilitator_signature_key || "", facilitatorSignature],
  ]);
  const signatureRegionWidth = 480;
  const signatureWidth = Math.min(165, signatureRegionWidth / Math.max(1, signatures.length));
  signatures.forEach((signature, index) => {
    const x = 48 + index * signatureWidth;
    const image = signature.key ? signatureImages.get(signature.key) : null;
    if (image) drawImageContain(page, image, x + 8, 91, signatureWidth - 16, 36);
    page.drawLine({ start: { x: x + 8, y: 88 }, end: { x: x + signatureWidth - 8, y: 88 }, thickness: 0.7, color: navy });
    const nameSize = fitText(signature.name, timesItalicBold, 10.5, signatureWidth - 14, 7.5);
    page.drawText(signature.name, { x: x + (signatureWidth - timesItalicBold.widthOfTextAtSize(signature.name, nameSize)) / 2, y: 72, size: nameSize, font: timesItalicBold, color: uccBlue });
    const titleLines = wrapText(signature.title, regular, 7, signatureWidth - 12, 2);
    titleLines.forEach((line, lineIndex) => page.drawText(line, { x: x + (signatureWidth - regular.widthOfTextAtSize(line, 7)) / 2, y: 60 - lineIndex * 8, size: 7, font: regular, color: muted }));
  });

  page.drawLine({ start: { x: 554, y: 126 }, end: { x: 660, y: 126 }, thickness: 1.5, color: gold });
  page.drawText(`Issued: ${formatDate(certificate.issued_at)}`, { x: 554, y: 109, size: 7.5, font: regular, color: muted });
  page.drawText(`Course code: ${certificate.course_code}`, { x: 554, y: 96, size: 7.5, font: regular, color: muted });
  const credentialLabel = `Credential ID: ${certificate.certificate_code}`;
  page.drawText(credentialLabel, { x: 554, y: 83, size: fitText(credentialLabel, bold, 7.5, 140, 5.5), font: bold, color: navy });
  page.drawText("Verify this credential online", { x: 554, y: 68, size: 7.5, font: bold, color: uccBlue });
  drawQr(page, verificationUrl, 705, 63, 76);
  page.drawText("SCAN TO VERIFY", { x: 713, y: 50, size: 6.5, font: bold, color: uccBlue });

  document.setTitle(`${certificate.course_code} · ${certificate.course_title}`);
  document.setAuthor("University of Cape Coast");
  document.setSubject(`Verified UCC Growth+ credential ${certificate.certificate_code}`);
  document.setCreator("UCC Growth+ Learning Platform");
  document.setProducer("UCC Growth+ Learning Platform");
  const issuedAt = new Date(certificate.issued_at);
  if (!Number.isNaN(issuedAt.getTime())) { document.setCreationDate(issuedAt); document.setModificationDate(issuedAt); }
  return document.save({ useObjectStreams: false });
}
