import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { ProgrammeConfig } from "./programme-policy";
import type { ProgrammeEnrolment, programmeStudyRecord } from "./programmes";

type StudyRecord = Awaited<ReturnType<typeof programmeStudyRecord>>;
export function programmeRecordCsv(config: ProgrammeConfig, record: StudyRecord) {
  const cell = (v: unknown) => { let s = String(v ?? ""); if (/^[=+@\-\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s; return '"' + s.replaceAll('"', '""') + '"'; };
  const rows: unknown[][] = [["Programme", config.code, config.qualificationTitle], ["Generated", record.generatedAt], ["Record", "Programme study record, subject to authorised academic review"], ["Term", "Course", "Title", "Credits", "Mark", "Grade", "Credit earned", "Evidence"]];
  for (const r of record.rows) rows.push([config.terms.find(t => t.id === r.termId)?.title, r.code, r.title, r.credits, r.mark, r.grade, r.complete ? r.credits : 0, r.evidence]);
  rows.push(["Total earned credits", record.earnedCredits], ["GPA", record.gpa?.toFixed(3) || "Not configured"], ["Award status", record.award?.status || "Not recorded"]);
  return rows.map(row => row.map(cell).join(",")).join("\r\n");
}
export async function programmeRecordPdf(config: ProgrammeConfig, e: ProgrammeEnrolment, record: StudyRecord) {
  const pdf = await PDFDocument.create(), regular = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const safe = (v: unknown) => String(v ?? "").replace(/[^\x20-\x7e\xa0-\xff]/g, " ");
  let page = pdf.addPage([595.28, 841.89]), y = 795;
  const line = (v: unknown, heading = false, size = 10) => { const words = safe(v).split(/\s+/), lines: string[] = []; let current = ""; for (const word of words) { const next = (current + " " + word).trim(); if (regular.widthOfTextAtSize(next, size) > 490 && current) { lines.push(current); current = word; } else current = next; } lines.push(current); for (const text of lines) { if (y < 65) { page = pdf.addPage([595.28, 841.89]); y = 795; } page.drawText(text.slice(0, 250), { x: 45, y, size, font: heading ? bold : regular, color: rgb(.04, .16, .24) }); y -= size + 7; } };
  line("PROGRAMME STUDY RECORD", true, 18); line(config.qualificationTitle, true, 14); line(config.code + " | " + config.academicUnit); line("Learner: " + (e.full_name || e.user_email)); line("Student number: " + (e.student_number || "Admission pending") + " | Cohort: " + e.cohort); line("Curriculum version is pinned to the admitted record. Generated: " + record.generatedAt); y -= 10;
  for (const term of config.terms) { line(term.title, true, 12); for (const r of record.rows.filter(x => x.termId === term.id)) { line(r.code + " | " + r.title, true); line("Credits: " + r.credits + " | Mark: " + (r.mark ?? "Pending / recognised") + " | Earned: " + (r.complete ? r.credits : 0) + (r.grade ? " | Grade: " + r.grade : "")); line(r.evidence, false, 9); } y -= 8; }
  line("Earned credits: " + record.earnedCredits + " of " + config.minimumCredits, true); if (record.gpa !== null) line("Configured GPA: " + record.gpa.toFixed(3)); line(record.gradingNote, false, 9);
  line("Award: " + (record.award ? record.award.status + " | " + record.award.reference + " | " + record.award.award_date : "Awaiting authorised academic decision"), true);
  if (record.award?.status === "under_review") line(record.award.review_note);
  line("This study record supports programme delivery and academic review. Official transcripts, award classification and degree parchments are released through the institution's authorised registry.", false, 9);
  for (const [i, p] of pdf.getPages().entries()) p.drawText("Private learner record | Page " + (i + 1) + " of " + pdf.getPageCount(), { x: 45, y: 32, size: 8, font: regular });
  return pdf.save();
}
