import { feeStateNative } from "./learning-billing";
import { getRawDb } from "@/db/raw";
import { officialCredentialsEnabled } from "./platform-mode";
import { getProgramme, programmeAudit, programmeConfig, programmeStudyRecord, type ProgrammeEnrolment } from "./programmes";
import { releasedProgrammeResult } from "./programme-results";
import { parseRecord } from "./course-access";

export type ProgrammeSignatory = { name: string; title: string; fileKey: string };
export type ProgrammeCertificateSnapshot = { learnerName: string; studentNumber: string; programmeCode: string; programmeTitle: string; qualificationTitle: string; award: string; academicUnit: string; curriculumVersion: number; credits: number; termCount: number; awardReference: string; awardDate: string; approvalReference: string; authority: string; provost: ProgrammeSignatory; academicLead: ProgrammeSignatory | null };
export type ProgrammeCertificate = { id: number; enrolment_id: number; credential_code: string; status: "active" | "under_review" | "revoked"; snapshot_json: string; issued_at: string };

export async function synchroniseProgrammeCredential(enrolmentId: number) {
  const db = getRawDb(), e = await db.prepare("SELECT e.*,u.full_name FROM programme_enrolments e JOIN users u ON u.email=e.user_email WHERE e.id=?").bind(enrolmentId).first<ProgrammeEnrolment>();
  if (!e) return null;
  const p = await getProgramme(e.programme_id), config = programmeConfig(p), record = await programmeStudyRecord(e, p);
  if (!config.certificate.enabled || !record.eligible || !["active", "graduated"].includes(e.status)) return record.certificate;
  const approval = parseRecord<Record<string, string>>(p.approval_json, {});
  if (approval.certificateAuthorised !== "true" || !await officialCredentialsEnabled()) return null;
  if (record.certificate) return record.certificate;
  if (config.certificate.release === "registry" && record.award?.status !== "active") return null;
  if (record.award && record.award.status !== "active") return null;
  return db.transaction(native => {
    if (!["enrollment","certificate"].every(purpose => feeStateNative(native,"programme",p.code,purpose as "enrollment"|"certificate",e.user_email,e.id).satisfied)) return null;
    const current = native.prepare("SELECT status,lock_version FROM programme_enrolments WHERE id=?").get(e.id) as { status: string; lock_version: number };
    if (current.lock_version !== e.lock_version || !["active", "graduated"].includes(current.status)) return null;
    const existing = native.prepare("SELECT credential_code,status,issued_at FROM programme_certificates WHERE enrolment_id=?").get(e.id); if (existing) return existing;
    for (const result of record.rows.filter(r => r.registered)) { const mark = releasedProgrammeResult(native, e.user_email, result.code); if ((mark?.score ?? null) !== result.mark || result.complete && !mark?.passed) return null; }
    const user = native.prepare("SELECT status,identity_status FROM users WHERE email=?").get(e.user_email) as { status: string; identity_status: string };
    if (user.status !== "active" || user.identity_status !== "verified") return null;
    const signature = (key: string): ProgrammeSignatory | null => { const row = native.prepare("SELECT signatory_name,signatory_title,file_key FROM certificate_signatures WHERE signature_key=?").get(key) as { signatory_name: string; signatory_title: string; file_key: string } | undefined; return row ? { name: row.signatory_name, title: row.signatory_title, fileKey: row.file_key } : null; };
    const provost = signature("provost"), academicLead = config.certificate.includeAcademicLead ? signature("facilitator:" + p.created_by_email) : null;
    if (!provost || config.certificate.includeAcademicLead && !academicLead) return null;
    const credentialCode = "UCC-PG-" + new Date().getUTCFullYear() + "-" + crypto.randomUUID().replaceAll("-", "").slice(0, 14).toUpperCase();
    const awardReference = record.award?.reference || "AUTO/" + config.code + "/" + e.id, awardDate = record.award?.award_date || new Date().toISOString().slice(0, 10);
    if (!record.award) {
      native.prepare("INSERT INTO programme_awards(enrolment_id,reference,award_date,status,evidence_json,recorded_by_email) VALUES(?,?,?,'active',?,?)").run(e.id, awardReference, awardDate, JSON.stringify({ config, progress: record, certificateAuthorisation: approval }), "system:preauthorised");
      native.prepare("UPDATE programme_enrolments SET status='graduated',lock_version=lock_version+1,decision_note='Programme requirements completed under recorded academic certificate authorisation.',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(e.id);
    }
    const snapshot: ProgrammeCertificateSnapshot = { learnerName: e.full_name || e.user_email, studentNumber: e.student_number || "", programmeCode: p.code, programmeTitle: p.title, qualificationTitle: config.qualificationTitle, award: config.award, academicUnit: config.academicUnit, curriculumVersion: p.version, credits: record.earnedCredits, termCount: config.terms.length, awardReference, awardDate, approvalReference: approval.reference, authority: approval.authority, provost, academicLead };
    native.prepare("INSERT INTO programme_certificates(enrolment_id,credential_code,status,snapshot_json) VALUES(?,?,'active',?)").run(e.id, credentialCode, JSON.stringify(snapshot));
    programmeAudit(native, { email: "system:preauthorised", role: "admin" }, "certificate_created", { enrolmentId: e.id, programmeId: p.id, credentialCode, release: config.certificate.release, approvalReference: approval.reference });
    return { credential_code: credentialCode, status: "active" };
  });
}
export async function synchroniseProgrammeCredentialsForCourse(email: string, code: string) {
  const records = await getRawDb().prepare("SELECT DISTINCT e.id FROM programme_enrolments e JOIN programme_registrations r ON r.enrolment_id=e.id WHERE e.user_email=? AND r.course_code=? AND e.status IN ('active','graduated')").bind(email, code).all<{ id: number }>();
  for (const record of records.results) { try { await synchroniseProgrammeCredential(record.id); } catch (error) { console.error("Programme credential synchronisation will retry when the programme record is opened.", error); } }
}

export async function reviewPendingProgrammeCredentials() {
  const db = getRawDb(), batch = await db.prepare("SELECT e.id FROM programme_enrolments e JOIN academic_programmes p ON p.id=e.programme_id WHERE e.status IN ('active','graduated') AND json_extract(p.config_json,'$.certificate.enabled')=1 ORDER BY COALESCE(e.certificate_checked_at,'1970-01-01'),e.id LIMIT 25").all<{id:number}>();
  for (const e of batch.results) { try { await synchroniseProgrammeCredential(e.id); } catch (error) { console.error("Programme certificate background review will retry.", error); } await db.prepare("UPDATE programme_enrolments SET certificate_checked_at=CURRENT_TIMESTAMP WHERE id=?").bind(e.id).run(); }
  return batch.results.length;
}
