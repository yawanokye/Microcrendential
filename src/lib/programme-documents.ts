import { readFile } from "node:fs/promises";
import { join } from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import sharp from "sharp";
import { getStoredFile } from "./render-storage";
import { makeVerificationQr } from "./qr-code";
import type { ProgrammeTranscript } from "./programme-transcript";
import type { ProgrammeCertificate, ProgrammeCertificateSnapshot } from "./programme-credentials";

const navy = rgb(.03, .16, .27), gold = rgb(.73, .55, .20), muted = rgb(.29, .36, .4);
async function fonts(pdf: PDFDocument) { pdf.registerFontkit(fontkit); const root = join(process.cwd(), "public", "fonts"); return { regular: await pdf.embedFont(await readFile(join(root, "DejaVuSans.ttf")), { subset: true }), bold: await pdf.embedFont(await readFile(join(root, "DejaVuSans-Bold.ttf")), { subset: true }), serif: await pdf.embedFont(await readFile(join(root, "DejaVuSerif.ttf")), { subset: true }) }; }
function wrap(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = []; let current = "";
  for (const word of text.trim().split(/\s+/)) {
    const candidate = current ? current + " " + word : word;
    if (font.widthOfTextAtSize(candidate, size) <= width) { current = candidate; continue; }
    if (current) { lines.push(current); current = ""; }
    for (const character of word) { if (current && font.widthOfTextAtSize(current + character, size) > width) { lines.push(current); current = character; } else current += character; }
  }
  if (current) lines.push(current); return lines.length ? lines : [""];
}
function centred(page: PDFPage, text: string, font: PDFFont, size: number, y: number, colour = navy) { page.drawText(text, { x: (page.getWidth() - font.widthOfTextAtSize(text, size)) / 2, y, size, font, color: colour }); }
function qr(page: PDFPage, url: string, x: number, y: number, size: number) { const matrix = makeVerificationQr(url), cell = size / (matrix.length + 8); page.drawRectangle({ x, y, width: size, height: size, color: rgb(1, 1, 1) }); matrix.forEach((row, r) => row.forEach((dark, c) => { if (dark) page.drawRectangle({ x: x + (c + 4) * cell, y: y + size - (r + 5) * cell, width: cell + .05, height: cell + .05, color: navy }); })); }

export function transcriptCsv(t: ProgrammeTranscript) { const cell = (value: unknown) => { let s = String(value ?? ""); if (/^[=+@\-\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s; return '"' + s.replaceAll('"', '""') + '"'; }; const rows: unknown[][] = [[t.documentType, t.status], ["Learner", t.learnerName, t.studentNumber], ["Programme", t.programmeCode, t.qualificationTitle, "Curriculum", t.curriculumVersion], ["Semester", "Course", "Title", "Credits", "Mark", "Grade", "Grade points", "Quality points", "Earned credits", "Result"]]; for (const term of t.terms) { for (const c of term.courses) rows.push([term.title, c.code, c.title, c.credits, c.mark, c.grade, c.gradePoints, c.qualityPoints, c.earnedCredits, c.status]); rows.push([term.title, "Semester GPA", term.semesterGpa, "Cumulative GPA", term.cumulativeGpa, "Cumulative earned credits", term.cumulativeEarnedCredits]); } rows.push(["Total earned credits", t.earnedCredits], ["Required credits", t.requiredCredits], ["Award reference", t.award?.reference], ["Grading basis", t.gradingNote]); return rows.map(r => r.map(cell).join(",")).join("\r\n"); }

export async function createTranscriptPdf(t: ProgrammeTranscript, verificationUrl?: string) {
  const pdf = await PDFDocument.create(), f = await fonts(pdf), width = 841.89, height = 595.28, margin = 38;
  let page: PDFPage, y = 0;
  const newPage = () => { page = pdf.addPage([width, height]); y = height - 38; page.drawText("UNIVERSITY OF CAPE COAST", { x: margin, y, size: 14, font: f.bold, color: navy }); y -= 24; page.drawText("ACADEMIC TRANSCRIPT · " + t.status.toUpperCase(), { x: margin, y, size: 12, font: f.bold, color: navy }); y -= 22; for (const text of [t.qualificationTitle, t.learnerName + " · " + t.studentNumber + " · " + t.cohort, t.programmeCode + " · Curriculum " + t.curriculumVersion + " · " + t.academicUnit]) { for (const line of wrap(text, f.regular, 9, width - margin * 2)) { page.drawText(line, { x: margin, y, size: 9, font: f.regular, color: navy }); y -= 14; } } y -= 9; };
  newPage();
  const columns = [78, 250, 50, 48, 45, 55, 64, 152], labels = ["Course", "Course title", "Credits", "Mark %", "Grade", "Points", "Quality pts", "Result"];
  const row = (values: string[], header = false) => { const lines = values.map((v, i) => wrap(v, header ? f.bold : f.regular, 8, columns[i] - 12)), h = Math.max(...lines.map(x => x.length)) * 11 + 12; if (y - h < 75) { newPage(); row(labels, true); } let x = margin; for (let i = 0; i < columns.length; i++) { page.drawRectangle({ x, y: y - h, width: columns[i], height: h, color: header ? rgb(.92, .95, .97) : rgb(1, 1, 1), borderColor: rgb(.78, .84, .86), borderWidth: .4 }); lines[i].forEach((line, j) => page.drawText(line, { x: x + 6, y: y - 15 - j * 11, font: header ? f.bold : f.regular, size: 8, color: navy })); x += columns[i]; } y -= h; };
  const paragraph = (text: string, bold = false) => { for (const line of wrap(text, bold ? f.bold : f.regular, 9, width - margin * 2)) { if (y < 70) newPage(); page.drawText(line, { x: margin, y, font: bold ? f.bold : f.regular, size: 9, color: navy }); y -= 14; } };
  for (const term of t.terms) {
    if (!term.courses.length) continue;
    if (y < 140) newPage(); paragraph(term.title, true); row(labels, true);
    for (const c of term.courses) row([c.code, c.title, String(c.credits), c.mark === null ? "-" : String(c.mark), c.grade || "-", c.gradePoints === null ? "-" : c.gradePoints.toFixed(2), c.qualityPoints === null ? "-" : c.qualityPoints.toFixed(2), c.status]);
    y -= 12; paragraph("Semester credits " + term.semesterCredits + " | Earned credits " + term.earnedCredits + " | Semester GPA " + (term.semesterGpa === null ? "Not configured / pending" : term.semesterGpa.toFixed(3)) + " | Cumulative GPA " + (term.cumulativeGpa === null ? "Not configured / pending" : term.cumulativeGpa.toFixed(3))); y -= 8;
  }
  paragraph("TOTAL EARNED CREDITS " + t.earnedCredits + " / " + t.requiredCredits + " | RECOGNISED CREDITS " + t.recognisedCredits + " | CGPA " + (t.cumulativeGpa === null ? "Not configured / pending" : t.cumulativeGpa.toFixed(3)), true);
  paragraph(t.gradingNote);
  if (t.gradingBands.length) paragraph("Approved grade bands: " + [...t.gradingBands].sort((a, b) => b.minimum - a.minimum).map(b => b.minimum + "+ = " + b.grade + " (" + b.points + " points)").join("; "));
  if (t.award) paragraph("Award reference: " + t.award.reference + " | Award date: " + t.award.award_date + " | Status: " + t.award.status, true);
  paragraph("Generated " + t.generatedAt);
  if (verificationUrl && t.certificate?.status === "active") { if (y < 118) newPage(); qr(page!, verificationUrl, margin, y - 68, 60); page!.drawText("Scan to verify the programme award", { x: margin + 82, y: y - 35, size: 9, font: f.regular, color: navy }); y -= 90; }
  for (const [i, p] of pdf.getPages().entries()) p.drawText(t.studentNumber + " | Private academic record | " + t.status + " | " + (i + 1) + "/" + pdf.getPageCount(), { x: margin, y: 25, size: 8, font: f.regular, color: muted });
  return pdf.save();
}

export async function createProgrammeCertificatePdf(c: ProgrammeCertificate, verificationUrl: string) {
  const s = JSON.parse(c.snapshot_json) as ProgrammeCertificateSnapshot, pdf = await PDFDocument.create(), f = await fonts(pdf), page = pdf.addPage([841.89, 595.28]), width = page.getWidth();
  page.drawRectangle({ x: 18, y: 18, width: width - 36, height: page.getHeight() - 36, borderColor: navy, borderWidth: 6 }); page.drawRectangle({ x: 29, y: 29, width: width - 58, height: page.getHeight() - 58, borderColor: gold, borderWidth: 1.5 });
  const crest = await pdf.embedPng(await readFile(join(process.cwd(), "public", "ucc_crest_approved_2026.png"))); const scaled = crest.scaleToFit(52, 58); page.drawImage(crest, { x: (width - scaled.width) / 2, y: 494, ...scaled });
  centred(page, "UNIVERSITY OF CAPE COAST", f.bold, 20, 465); centred(page, s.academicUnit.slice(0, 100), f.regular, Math.min(11, 690 / Math.max(1, f.regular.widthOfTextAtSize(s.academicUnit.slice(0, 100), 1))), 444);
  centred(page, ["bachelors", "masters", "doctorate"].includes(s.award) ? "DEGREE CERTIFICATE" : "CERTIFICATE OF AWARD", f.serif, 24, 402, gold);
  centred(page, "This is to certify that", f.regular, 12, 368);
  const nameSize = Math.min(29, 690 / Math.max(1, f.serif.widthOfTextAtSize(s.learnerName, 1))); centred(page, s.learnerName, f.serif, nameSize, 327);
  centred(page, "has fulfilled the approved requirements for", f.regular, 12, 292);
  let titleSize = 18; while (wrap(s.qualificationTitle, f.bold, titleSize, 690).length > 3 && titleSize > 5) titleSize -= .5; const titleLines = wrap(s.qualificationTitle, f.bold, titleSize, 690); titleLines.forEach((line, i) => centred(page, line, f.bold, titleSize, 258 - i * 23));
  const detailsY = Math.min(210, 258 - titleLines.length * 23 - 12); centred(page, s.credits + " credits · " + s.termCount + " semesters / terms · Awarded " + s.awardDate, f.regular, 11, detailsY);
  const signature = async (signatory: ProgrammeCertificateSnapshot["provost"], x: number) => { const stored = await getStoredFile(signatory.fileKey), image = await pdf.embedPng(await sharp(stored.body).png().toBuffer()), scale = image.scaleToFit(150, 44); page.drawImage(image, { x: x + (170 - scale.width) / 2, y: 122, ...scale }); page.drawLine({ start: { x, y: 115 }, end: { x: x + 170, y: 115 }, color: gold, thickness: .6 }); const size = Math.min(10, 170 / Math.max(1, f.bold.widthOfTextAtSize(signatory.name, 1))); page.drawText(signatory.name, { x, y: 100, size, font: f.bold, color: navy }); wrap(signatory.title, f.regular, 8, 170).slice(0, 2).forEach((line, i) => page.drawText(line, { x, y: 86 - i * 11, size: 8, font: f.regular, color: navy })); };
  await signature(s.provost, s.academicLead ? 508 : 565); if (s.academicLead) await signature(s.academicLead, 145);
  qr(page, verificationUrl, s.academicLead ? 380 : 90, 85, 75);
  centred(page, c.credential_code + " · " + s.programmeCode + " · Curriculum " + s.curriculumVersion, f.regular, 8, 54); centred(page, "Academic authority reference: " + s.approvalReference + " · " + s.awardReference, f.regular, 7, 41);
  return pdf.save();
}
