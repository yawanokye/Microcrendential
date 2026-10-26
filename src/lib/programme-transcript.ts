import type { ProgrammeConfig } from "./programme-policy";
import type { ProgrammeEnrolment, programmeStudyRecord } from "./programmes";
type RecordData = Omit<Awaited<ReturnType<typeof programmeStudyRecord>>, "finance"|"moduleFinance">;

export function buildProgrammeTranscript(config: ProgrammeConfig, e: ProgrammeEnrolment, record: RecordData, version: number) {
  let cumulativeCredits = 0, cumulativeQuality = 0, cumulativeEarned = 0;
  const terms = config.terms.map(term => {
    const courses = record.rows.filter(r => r.termId === term.id && (r.registered || r.recognised)).map(r => ({ code: r.code, title: r.title, credits: r.credits, mark: r.mark, grade: r.recognised ? "CR" : r.grade, gradePoints: r.recognised ? null : r.gradePoints, qualityPoints: !r.recognised && r.gradePoints !== null ? r.credits * r.gradePoints : null, earnedCredits: r.complete ? r.credits : 0, recognised: r.recognised, status: r.recognised ? "Recognised credit" : r.complete ? "Passed" : r.mark === null ? "Pending" : "Requirements pending", evidence: r.evidence }));
    const gradedCredits = courses.filter(r => r.gradePoints !== null).reduce((s, r) => s + r.credits, 0), qualityPoints = courses.reduce((s, r) => s + (r.qualityPoints || 0), 0), earnedCredits = courses.reduce((s, r) => s + r.earnedCredits, 0);
    cumulativeCredits += gradedCredits; cumulativeQuality += qualityPoints; cumulativeEarned += earnedCredits;
    return { id: term.id, title: term.title, courses, semesterCredits: courses.reduce((s, r) => s + r.credits, 0), registeredCredits: courses.filter(r => !r.recognised).reduce((s, r) => s + r.credits, 0), earnedCredits, gradedCredits, qualityPoints, semesterGpa: config.grading.enabled && gradedCredits ? qualityPoints / gradedCredits : null, cumulativeGpa: config.grading.enabled && cumulativeCredits ? cumulativeQuality / cumulativeCredits : null, cumulativeEarnedCredits: cumulativeEarned };
  });
  return { documentType: "Academic transcript", status: record.award?.status === "active" && record.eligible ? "Final" : record.award && record.award.status !== "active" ? "Under academic review" : "Provisional", learnerName: e.full_name || e.user_email, studentNumber: e.student_number || "Admission pending", cohort: e.cohort, programmeCode: config.code, qualificationTitle: config.qualificationTitle, academicUnit: config.academicUnit, curriculumVersion: version, requiredCredits: config.minimumCredits, earnedCredits: record.earnedCredits, recognisedCredits: record.recognisedCredits, cumulativeGpa: record.gpa, gradingEnabled: config.grading.enabled, gradingBands: config.grading.enabled ? config.grading.bands : [], gradingNote: record.gradingNote, terms, award: record.award, certificate: record.certificate, generatedAt: new Date().toISOString() };
}
export type ProgrammeTranscript = ReturnType<typeof buildProgrammeTranscript>;
