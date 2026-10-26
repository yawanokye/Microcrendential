import { audienceAllowedNative, audienceCompatibilityNative } from "./catalogue-access";
import { currentBillingNative, feeStateNative, learnerFinance } from "./learning-billing";
import type { DatabaseSync } from "node:sqlite";
import { getRawDb } from "@/db/raw";
import type { AccountProfile } from "./accounts";
import { enrolWithSnapshotInTransaction, parseRecord } from "./course-access";
import { normalizeCourseDesign } from "./course-design";
import { evaluateCourseCompletion } from "./course-completion";
import { assessmentRequired } from "./delivery-policy";
import { programmeResultSql, releasedProgrammeResult, type ReleasedProgrammeResult } from "./programme-results";

import { normalizeProgramme, programmeEvidenceFingerprint, programmeIssues, programmeProgress, programmeRegistrationIssues, type ProgrammeConfig, type ProgrammeResult } from "./programme-policy";

export type ProgrammeRow = { id: number; code: string; title: string; version: number; status: "draft" | "review" | "active" | "superseded" | "closed"; config_json: string; created_by_email: string; lock_version: number; approval_json: string; review_note: string; updated_at: string };
export type ProgrammeEnrolment = { id: number; programme_id: number; programme_code: string; user_email: string; student_number: string | null; full_name?: string; cohort: string; status: "applied" | "active" | "deferred" | "withdrawn" | "rejected" | "graduated"; current_term: number; lock_version: number; application_statement: string; admission_reference: string; fee_coverage: "course_fees" | "programme_clearance"; financial_reference: string; decision_note: string; admitted_at: string | null; created_at: string };
export class ProgrammeError extends Error { constructor(message: string, public status = 400) { super(message); } }
export const cleanProgrammeText = (value: unknown, length = 4000) => String(value ?? "").trim().slice(0, length);
type Actor = Pick<AccountProfile, "email" | "role">;
export function programmeAudit(db: DatabaseSync, actor: Actor, action: string, details: object) { db.prepare("INSERT INTO admin_audit_log(admin_email,action,details_json) VALUES(?,?,?)").run(actor.email, "programme." + action, JSON.stringify(details)); }
export const programmeConfig = (row: ProgrammeRow) => normalizeProgramme(parseRecord(row.config_json, {}));
export function presentProgramme(row: ProgrammeRow, staff = false) {
  const approval = parseRecord<Record<string, string>>(row.approval_json, {});
  return { billing:getRawDb().read(db=>currentBillingNative(db,"programme",row.code)), id: row.id, code: row.code, title: row.title, version: row.version, status: row.status, config: programmeConfig(row), lockVersion: row.lock_version, approval: { authority: approval.authority || "", reference: approval.reference || "", date: approval.date || "", certificateAuthorised: approval.certificateAuthorised === "true" }, reviewNote: staff ? row.review_note : "", ...(staff ? { createdByEmail: row.created_by_email } : {}) };
}
export async function getProgramme(id: number) { const p = await getRawDb().prepare("SELECT * FROM academic_programmes WHERE id=?").bind(id).first<ProgrammeRow>(); if (!p) throw new ProgrammeError("Programme not found.", 404); return p; }
export function canManageProgramme(actor: Actor, p: ProgrammeRow) { return actor.role === "admin" || actor.role === "facilitator" && p.created_by_email === actor.email; }
export async function getProgrammeEnrolment(id: number, actor: Actor) {
  let e = await getRawDb().prepare("SELECT e.*,u.full_name FROM programme_enrolments e JOIN users u ON u.email=e.user_email WHERE e.id=?").bind(id).first<ProgrammeEnrolment>();
  if (!e) throw new ProgrammeError("Programme enrolment not found.", 404);
  const p = await getProgramme(e.programme_id);
  if (actor.role === "learner" ? e.user_email !== actor.email : !canManageProgramme(actor, p)) throw new ProgrammeError("Programme enrolment not found.", 404);
  await (await import("./programme-credentials")).synchroniseProgrammeCredential(e.id);
  e = await getRawDb().prepare("SELECT e.*,u.full_name FROM programme_enrolments e JOIN users u ON u.email=e.user_email WHERE e.id=?").bind(id).first<ProgrammeEnrolment>();
  if (!e) throw new ProgrammeError("Programme enrolment not found.", 404);
  return { enrolment: e, programme: p };
}
export async function validateProgrammeCourses(config: ProgrammeConfig) {
  const issues = programmeIssues(config);
  const accessError=getRawDb().read(db=>audienceCompatibilityNative(db,"programme",config.code,config.courses.map(c=>c.code)));if(accessError)issues.push(accessError);
  for (const x of config.courses) {
    const course = await getRawDb().prepare("SELECT design_json FROM course_drafts WHERE code=? AND status='active' LIMIT 1").bind(x.code).first<{ design_json: string }>();
    if (!course) { issues.push(x.code + " must be an active, academically approved course before the programme is submitted."); continue; }
    const design = normalizeCourseDesign(parseRecord(course.design_json, {}));
    if (design.credentialStructure === "broader" || !assessmentRequired(design.certificate.awardType)) issues.push(x.code + " must supply its own assessed course evidence. Attendance awards and aggregate pathways cannot be counted as programme courses.");
  }
  return [...new Set(issues)];
}
export async function programmeStudyRecord(e: ProgrammeEnrolment, p: ProgrammeRow) {
  const db = getRawDb(), config = programmeConfig(p), results: ProgrammeResult[] = [];
  const registrations = (await db.prepare("SELECT course_code,course_version,created_at FROM programme_registrations WHERE enrolment_id=?").bind(e.id).all<{ course_code: string; course_version: number; created_at: string }>()).results;
  const credits = (await db.prepare("SELECT course_code,mark,reference,status,reason FROM programme_credit_decisions WHERE enrolment_id=?").bind(e.id).all<{ course_code: string; mark: number | null; reference: string; status: string; reason: string }>()).results;
  for (const course of config.courses) {
    const credit = credits.find(c => c.course_code === course.code && c.status === "granted");
    if (credit) { results.push({ code: course.code, mark: credit.mark, complete: true, registered: false, recognised: true, evidence: "Registry-approved recognised credit: " + credit.reference }); continue; }
    if (!registrations.some(r => r.course_code === course.code)) continue;
    const assessment = await db.prepare(programmeResultSql).bind(e.user_email, course.code, e.user_email, course.code).first<ReleasedProgrammeResult>();
    const evaluation = await evaluateCourseCompletion(e.user_email, course.code);
    const certificate = await db.prepare("SELECT status FROM certificates WHERE user_email=? AND course_code=?").bind(e.user_email, course.code).first<{ status: string }>();
    const complete = Boolean(evaluation?.complete && assessment?.passed && (!certificate || certificate.status === "active"));
    results.push({ code: course.code, mark: assessment?.score ?? null, complete, registered: true, recognised: false, evidence: complete ? "Released platform result and current course requirements satisfied" : certificate && certificate.status !== "active" ? "Associated credential requires academic review" : assessment?.passed ? "Complete the remaining course or verification requirements" : assessment ? "Released assessment result does not satisfy course completion" : "Awaiting a released final result" });
  }
  const progress = programmeProgress(config, results);
  if (!["active", "graduated"].includes(e.status)) { progress.eligible = false; progress.blockers.push("An active admitted programme enrolment is required."); }
  let award = await db.prepare("SELECT id,reference,award_date,status,review_note,created_at FROM programme_awards WHERE enrolment_id=?").bind(e.id).first<{ id: number; reference: string; award_date: string; status: string; review_note: string; created_at: string }>();
  const snapshot = award?.status === "active" ? await db.prepare("SELECT evidence_json FROM programme_awards WHERE id=?").bind(award.id).first<{evidence_json:string}>() : null;
  const priorRows = parseRecord<{progress?: {rows?: typeof progress.rows}}>(snapshot?.evidence_json, {}).progress?.rows;
  const releasedResultsChanged = Boolean(priorRows && programmeEvidenceFingerprint(priorRows) !== programmeEvidenceFingerprint(progress.rows));
  if (award?.status === "active" && (!progress.eligible || releasedResultsChanged)) {
    db.transaction(native => { const changed = native.prepare("UPDATE programme_awards SET status='under_review',review_note='Programme requirements or released results changed. Academic review is required.',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='active'").run(award!.id); if (changed.changes) programmeAudit(native, { email: "system", role: "admin" }, "award_flagged", { enrolmentId: e.id, awardId: award!.id }); });
    await db.prepare("UPDATE programme_certificates SET status='under_review' WHERE enrolment_id=? AND status='active'").bind(e.id).run();
    award = { ...award, status: "under_review", review_note: "Programme requirements or released results changed. Academic review is required." };
  }
  const certificate = await db.prepare("SELECT credential_code,status,issued_at FROM programme_certificates WHERE enrolment_id=?").bind(e.id).first<{credential_code:string;status:string;issued_at:string}>();
  const moduleFinance=Object.fromEntries(config.courses.map(c=>[c.code,feeStateNativeForCourse(c.code)]));
  function feeStateNativeForCourse(code:string){return db.read(native=>feeStateNative(native,"course",code,"enrollment",e.user_email));}
  return { ...progress, moduleFinance, finance: learnerFinance("programme",p.code,e.user_email,e.id), registrations, creditDecisions: credits, award, certificate, gradingNote: config.grading.enabled ? "Credit-weighted GPA uses the latest released mark for each registered course, including failures. Recognised credit is excluded. Programme classification follows the approved institutional rules." : "Percentage marks and earned credits are shown. No GPA policy has been enabled.", generatedAt: new Date().toISOString() };
}
const validProgrammeDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
const rowEarlierThanAdmission = (completed: string, admitted: string | null) => Boolean(admitted && Date.parse(completed.replace(" ", "T") + (/[Z+]/.test(completed) ? "" : "Z")) < Date.parse(admitted.replace(" ", "T") + (/[Z+]/.test(admitted) ? "" : "Z")));
function currentProgramme(native: DatabaseSync, id: number, expected: number) { const row = native.prepare("SELECT * FROM academic_programmes WHERE id=?").get(id) as ProgrammeRow | undefined; if (!row) throw new ProgrammeError("Programme not found.", 404); if (row.lock_version !== expected) throw new ProgrammeError("This programme changed. Refresh before saving or approving it.", 409); return row; }
function currentEnrolment(native: DatabaseSync, id: number, expected: number) { const row = native.prepare("SELECT * FROM programme_enrolments WHERE id=?").get(id) as ProgrammeEnrolment | undefined; if (!row || row.lock_version !== expected) throw new ProgrammeError("This enrolment changed. Refresh before recording a decision.", 409); return row; }
export async function saveProgramme(actor: Actor, payload: Record<string, unknown>) {
  if (actor.role === "learner") throw new ProgrammeError("Academic authoring access is required.", 403);
  const action = String(payload.action || "save"), id = Number(payload.id), expected = Number(payload.expectedVersion);
  if (action === "create") {
    const c = normalizeProgramme(payload.config);
    if (!/^[A-Z0-9][A-Z0-9 ._/-]{1,59}$/.test(c.code)) throw new ProgrammeError("Set a distinct programme code before saving the draft.");
    return getRawDb().transaction(native => { if (native.prepare("SELECT id FROM academic_programmes WHERE code=?").get(c.code)) throw new ProgrammeError("This code already exists. Open its curriculum or create a revised draft.", 409); const insert = native.prepare("INSERT INTO academic_programmes(code,title,version,status,config_json,created_by_email) VALUES(?,?,1,'draft',?,?)").run(c.code, c.title || c.code, JSON.stringify(c), actor.email); programmeAudit(native, actor, "created", { id: Number(insert.lastInsertRowid), code: c.code }); return Number(insert.lastInsertRowid); });
  }
  const p = await getProgramme(id); if (!canManageProgramme(actor, p)) throw new ProgrammeError("You cannot manage this programme.", 403);
  if (action === "revise") return getRawDb().transaction(native => { const row = currentProgramme(native, id, expected); if (!["active", "superseded", "closed"].includes(row.status)) throw new ProgrammeError("Revise a previously approved curriculum.", 409); if (native.prepare("SELECT id FROM academic_programmes WHERE code=? AND status IN ('draft','review')").get(row.code)) throw new ProgrammeError("An editable revision already exists for this programme.", 409); const version = (native.prepare("SELECT MAX(version) n FROM academic_programmes WHERE code=?").get(row.code) as { n: number }).n + 1; const r = native.prepare("INSERT INTO academic_programmes(code,title,version,status,config_json,created_by_email) VALUES(?,?,?,'draft',?,?)").run(row.code, row.title, version, row.config_json, row.created_by_email); programmeAudit(native, actor, "revision_created", { id: Number(r.lastInsertRowid), previousId: id }); return Number(r.lastInsertRowid); });
  const config = action === "save" || action === "submit" ? normalizeProgramme(payload.config) : programmeConfig(p);
  if (config.code !== p.code) throw new ProgrammeError("The programme code is fixed after its first save. Create a separate programme to use another code.");
  if (["submit", "activate"].includes(action)) { const issues = await validateProgrammeCourses(config); if (issues.length) throw new ProgrammeError(issues.join(" ")); }
  return getRawDb().transaction(native => {
    const row = currentProgramme(native, id, expected); let status = row.status, approval = row.approval_json, note = row.review_note;
    if (action === "save" || action === "submit") { if (row.status !== "draft") throw new ProgrammeError("Only a draft can be edited. Return a submission or create a revised curriculum.", 409); status = action === "submit" ? "review" : "draft"; }
    else if (action === "activate") {
      if (actor.role !== "admin") throw new ProgrammeError("Only an administrator can record academic approval.", 403);
      if (row.status !== "review") throw new ProgrammeError("Submit the curriculum for review before activation.", 409);
      const a = payload.approval as Record<string, unknown> | undefined;
      if (!a || cleanProgrammeText(a.authority).length < 3 || cleanProgrammeText(a.reference).length < 3 || !validProgrammeDate(String(a.date))) throw new ProgrammeError("Record the academic authority, approval reference and valid approval date.");
      if (config.certificate.enabled) {
        if (a.authoriseCertificate !== true) throw new ProgrammeError("Confirm academic authorisation for programme certificate issuance before opening this curriculum.");
        if (!native.prepare("SELECT signature_key FROM certificate_signatures WHERE signature_key='provost'").get()) throw new ProgrammeError("Register the Provost signature before authorising programme certificates.");
        if (config.certificate.includeAcademicLead && !native.prepare("SELECT signature_key FROM certificate_signatures WHERE signature_key=?").get("facilitator:" + row.created_by_email)) throw new ProgrammeError("Register the programme lead’s facilitator signature before authorising it on certificates.");
      }
      approval = JSON.stringify({ certificateAuthorised: config.certificate.enabled ? "true" : "false", authority: cleanProgrammeText(a.authority, 240), reference: cleanProgrammeText(a.reference, 240), date: String(a.date), recordedBy: actor.email, recordedAt: new Date().toISOString() });
      native.prepare("UPDATE academic_programmes SET status='superseded',lock_version=lock_version+1,updated_at=CURRENT_TIMESTAMP WHERE code=? AND status='active'").run(row.code); status = "active";
    } else if (action === "return" || action === "close") {
      if (actor.role !== "admin") throw new ProgrammeError("Administrator access is required for this decision.", 403);
      if (action === "return" && row.status !== "review" || action === "close" && row.status !== "active") throw new ProgrammeError("This programme is not awaiting that decision.", 409);
      note = cleanProgrammeText(payload.note); if (note.length < 10) throw new ProgrammeError("Record a reason for this academic decision."); status = action === "return" ? "draft" : "closed";
    } else throw new ProgrammeError("Choose a supported programme action.");
    native.prepare("UPDATE academic_programmes SET title=?,config_json=?,status=?,approval_json=?,review_note=?,lock_version=lock_version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(config.title || config.code, JSON.stringify(config), status, approval, note, id);
    programmeAudit(native, actor, action, { id, code: row.code, version: row.version }); return id;
  });
}
export async function applyToProgramme(actor: Actor, programmeId: number, statement: unknown) {
  if (actor.role !== "learner") throw new ProgrammeError("Only learners can apply for admission.", 403);
  return getRawDb().transaction(native => { const p = native.prepare("SELECT * FROM academic_programmes WHERE id=? AND status='active'").get(programmeId) as ProgrammeRow | undefined; if (!p || !audienceAllowedNative(native,"programme",p.code,actor)) throw new ProgrammeError("This programme is not open for applications.", 404); const existing = native.prepare("SELECT id FROM programme_enrolments WHERE programme_code=? AND user_email=?").get(p.code, actor.email) as { id: number } | undefined; if (existing) return existing.id; const r = native.prepare("INSERT INTO programme_enrolments(programme_id,programme_code,user_email,status,application_statement) VALUES(?,?,?,'applied',?)").run(p.id, p.code, actor.email, cleanProgrammeText(statement)); programmeAudit(native, actor, "applied", { programmeId, enrolmentId: Number(r.lastInsertRowid) }); return Number(r.lastInsertRowid); });
}
export async function checkProgrammeCourseCheckout(actor:Actor,enrolmentId:number,code:string){
 const {enrolment:e,programme:p}=await getProgrammeEnrolment(enrolmentId,actor),config=programmeConfig(p);
 if(e.status!=="active"||!audienceAllowedNativeForLearner())throw new ProgrammeError("An active admitted curriculum and current audience eligibility are required.",403);
 function audienceAllowedNativeForLearner(){return getRawDb().read(db=>audienceAllowedNative(db,"programme",p.code,{email:e.user_email,role:"learner"})&&audienceAllowedNative(db,"course",code,{email:e.user_email,role:"learner"}));}
 const record=await programmeStudyRecord(e,p),issues=programmeRegistrationIssues(config,record,code,e.current_term);
 if(issues.length)throw new ProgrammeError(issues.join(" "),409);
 if(record.rows.find(r=>r.code===code)?.recognised)throw new ProgrammeError("This course already has recognised credit.",409);
 const prior=getRawDb().read(db=>releasedProgrammeResult(db,e.user_email,code));
 if(!config.allowPriorPlatformResults&&prior?.passed&&rowEarlierThanAdmission(prior.completed_at,e.admitted_at))throw new ProgrammeError("This earlier pass requires registry-approved credit recognition before course payment.",409);
 const tuition=getRawDb().read(db=>feeStateNative(db,"programme",p.code,"enrollment",e.user_email,e.id));
 if(!tuition.satisfied)throw new ProgrammeError("Confirm programme tuition funding before paying individual course fees.",409);
 return {enrolment:e,programme:p};
}
export async function registerProgrammeCourse(actor: Actor, enrolmentId: number, code: string) {
  const { enrolment: e, programme: p } = await getProgrammeEnrolment(enrolmentId, actor);
  if (actor.role !== "learner" && actor.role !== "admin") throw new ProgrammeError("The learner or authorised registry must register the course.", 403);
  if (e.status !== "active") throw new ProgrammeError("Admission and an active programme enrolment are required.", 409);
  const config = programmeConfig(p), progress = await programmeStudyRecord(e, p), issues = programmeRegistrationIssues(config, progress, code, e.current_term);
  if (issues.length) throw new ProgrammeError(issues.join(" "), 409);
  if (progress.rows.find(r => r.code === code)?.recognised) throw new ProgrammeError("This course already has approved recognised credit.", 409);
  return getRawDb().transaction(native => {
    const current = currentEnrolment(native, e.id, e.lock_version); if (current.status !== "active") throw new ProgrammeError("This programme enrolment is not active.", 409);
    if (!audienceAllowedNative(native,"programme",p.code,{email:e.user_email,role:"learner"}) || !audienceAllowedNative(native,"course",code,{email:e.user_email,role:"learner"})) throw new ProgrammeError("This course is not available to the learner’s current access group.",403);
    const tuition = feeStateNative(native,"programme",p.code,"enrollment",e.user_email,e.id);
    if (!tuition.satisfied) throw new ProgrammeError(tuition.requiresOrganisation ? "Organisation funding is required before registration." : "Programme tuition payment is required. Use the programme fees panel.",402);
    const already = native.prepare("SELECT id FROM programme_registrations WHERE enrolment_id=? AND course_code=?").get(e.id, code); if (already) return;
    const course = native.prepare("SELECT design_json,version_number FROM course_drafts WHERE code=? AND status='active' LIMIT 1").get(code) as { design_json: string; version_number: number } | undefined; if (!course) throw new ProgrammeError("This curriculum course is not currently available.", 409);
    const prior = releasedProgrammeResult(native, e.user_email, code);
    if (!config.allowPriorPlatformResults && prior?.passed && rowEarlierThanAdmission(prior.completed_at, e.admitted_at)) throw new ProgrammeError("This earlier platform pass needs registry-approved credit recognition or an approved policy allowing earlier platform results. A new course offering can be used for a fresh attempt.", 409);
    const existing = native.prepare("SELECT course_snapshot_json FROM enrollments WHERE user_email=? AND course_code=? AND status IN ('active','completed')").get(e.user_email, code) as {course_snapshot_json:string}|undefined;
    const moduleFee = feeStateNative(native,"course",code,"enrollment",e.user_email);
    const programmeCovers = tuition.terms.includesCourseFees && tuition.satisfied;
    if (!existing && !programmeCovers && !(e.fee_coverage === "programme_clearance" && !moduleFee.terms.managed) && !moduleFee.satisfied) throw new ProgrammeError(moduleFee.requiresOrganisation ? "Organisation funding is required for this course." : "Complete the course payment or obtain recorded programme tuition clearance.",402);
    for (const prerequisite of config.courses.find(x => x.code === code)!.prerequisites) { const recognised = native.prepare("SELECT id FROM programme_credit_decisions WHERE enrolment_id=? AND course_code=? AND status='granted'").get(e.id, prerequisite); const currentMark = releasedProgrammeResult(native, e.user_email, prerequisite); if (!recognised && (!currentMark?.passed || currentMark.score < config.courses.find(x => x.code === prerequisite)!.passMark)) throw new ProgrammeError("A prerequisite result changed. Refresh the study record.", 409); }
    const enrolled = enrolWithSnapshotInTransaction(native, e.user_email, code); if (enrolled.error) throw new ProgrammeError(enrolled.error, 409);
    native.prepare("INSERT INTO programme_registrations(enrolment_id,course_code,course_version,registered_by_email) VALUES(?,?,?,?)").run(e.id, code, existing ? parseRecord<{version_number?:number}>(existing.course_snapshot_json, {}).version_number || course.version_number : course.version_number, actor.email); programmeAudit(native, actor, "course_registered", { enrolmentId: e.id, courseCode: code, feeCoverage: e.fee_coverage });
  });
}
export async function decideProgrammeEnrolment(actor: Actor, payload: Record<string, unknown>) {
  if (actor.role !== "admin") throw new ProgrammeError("Only an authorised administrator can record admission, credit, progression and award decisions.", 403);
  const { enrolment: e, programme: p } = await getProgrammeEnrolment(Number(payload.enrolmentId), actor), action = String(payload.action), config = programmeConfig(p), note = cleanProgrammeText(payload.note), expected = Number(payload.expectedVersion);
  const progress = ["advance", "graduate", "confirm_award", "recognise_credit"].includes(action) ? await programmeStudyRecord(e, p) : null;
  return getRawDb().transaction(native => {
    const row = currentEnrolment(native, e.id, expected); let status = row.status;
    if (progress && ["advance", "graduate", "confirm_award"].includes(action)) for (const result of progress.rows.filter(r => r.registered)) {
      const source = releasedProgrammeResult(native, e.user_email, result.code);
      if ((source?.score ?? null) !== result.mark || result.complete && !source?.passed) throw new ProgrammeError("A released course result changed. Refresh before recording the academic decision.", 409);
    }
    const previousCredit = payload.courseCode ? native.prepare("SELECT * FROM programme_credit_decisions WHERE enrolment_id=? AND course_code=?").get(e.id, cleanProgrammeText(payload.courseCode,120).toUpperCase()) : null;
    if (action === "admit") {
      if (row.status !== "applied" || p.status !== "active") throw new ProgrammeError("Only an application to the active curriculum can be admitted.", 409);
      const number = cleanProgrammeText(payload.studentNumber, 100), reference = cleanProgrammeText(payload.admissionReference, 240), cohort = cleanProgrammeText(payload.cohort, 160), coverage = payload.feeCoverage === "programme_clearance" ? "programme_clearance" : "course_fees", financial = cleanProgrammeText(payload.financialReference, 240);
      if (!number || reference.length < 3 || !cohort || coverage === "programme_clearance" && financial.length < 3) throw new ProgrammeError("Record the student number, admission authority reference, cohort and any programme tuition clearance reference.");
      native.prepare("UPDATE programme_enrolments SET billing_snapshot_json=?,student_number=?,cohort=?,admission_reference=?,fee_coverage=?,financial_reference=?,status='active',admitted_by_email=?,admitted_at=CURRENT_TIMESTAMP,lock_version=lock_version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(JSON.stringify(currentBillingNative(native,"programme",p.code)),number, cohort, reference, coverage, financial, actor.email, e.id);
    } else if (action === "financial_clearance") {
      if (!["active", "deferred"].includes(row.status)) throw new ProgrammeError("Financial clearance applies to an admitted learner.", 409);
      const coverage = payload.feeCoverage === "programme_clearance" ? "programme_clearance" : "course_fees", reference = cleanProgrammeText(payload.financialReference, 240);
      if (note.length < 10 || coverage === "programme_clearance" && reference.length < 3) throw new ProgrammeError("Record the financial decision and the programme tuition clearance reference when selected.");
      native.prepare("UPDATE programme_enrolments SET fee_coverage=?,financial_reference=?,decision_note=?,lock_version=lock_version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(coverage, reference, note, e.id);
    } else if (action === "recognise_credit") {
      if (!config.allowCreditRecognition || !["active", "deferred"].includes(row.status)) throw new ProgrammeError("Credit recognition must be enabled in the approved curriculum for an admitted learner.", 409);
      const code = cleanProgrammeText(payload.courseCode, 120).toUpperCase(), course = config.courses.find(x => x.code === code), reference = cleanProgrammeText(payload.reference, 240), mark = payload.mark === null || payload.mark === "" || payload.mark === undefined ? null : Number(payload.mark);
      if (!course || reference.length < 3 || note.length < 20 || mark !== null && (!Number.isFinite(mark) || mark < course.passMark || mark > 100)) throw new ProgrammeError("Choose a curriculum course and record the approval reference, evidence reason and a passing mark when supplied.");
      if (native.prepare("SELECT id FROM programme_registrations WHERE enrolment_id=? AND course_code=?").get(e.id, code)) throw new ProgrammeError("A registered platform course must be assessed through its course workflow, not replaced with recognised credit.", 409);
      const other = progress!.rows.filter(r => r.recognised && r.code !== code).reduce((s, r) => s + r.credits, 0); if (other + course.credits > config.maximumRecognisedCredits) throw new ProgrammeError("This decision would exceed the recognised-credit limit.", 409);
      native.prepare("INSERT INTO programme_credit_decisions(enrolment_id,course_code,mark,status,reference,reason,decided_by_email) VALUES(?,?,?,'granted',?,?,?) ON CONFLICT(enrolment_id,course_code) DO UPDATE SET mark=excluded.mark,status='granted',reference=excluded.reference,reason=excluded.reason,decided_by_email=excluded.decided_by_email,updated_at=CURRENT_TIMESTAMP").run(e.id, code, mark, reference, note, actor.email);
      native.prepare("UPDATE programme_enrolments SET lock_version=lock_version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(e.id);
    } else if (action === "revoke_credit") {
      if (note.length < 10) throw new ProgrammeError("Record why this recognised-credit decision is being revoked.");
      const changed = native.prepare("UPDATE programme_credit_decisions SET status='revoked',reason=?,decided_by_email=?,updated_at=CURRENT_TIMESTAMP WHERE enrolment_id=? AND course_code=? AND status='granted'").run(note, actor.email, e.id, cleanProgrammeText(payload.courseCode, 120).toUpperCase()); if (!changed.changes) throw new ProgrammeError("No current credit decision was found.", 404);
      native.prepare("UPDATE programme_enrolments SET lock_version=lock_version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(e.id);
      native.prepare("UPDATE programme_awards SET status='under_review',review_note=?,updated_at=CURRENT_TIMESTAMP WHERE enrolment_id=? AND status='active'").run(note, e.id);
      native.prepare("UPDATE programme_certificates SET status='under_review' WHERE enrolment_id=? AND status='active'").run(e.id);
    } else if (action === "revoke_award") {
      if (note.length < 10) throw new ProgrammeError("Record the authority and reason for revoking this programme award.");
      const changed = native.prepare("UPDATE programme_awards SET status='revoked',review_note=?,recorded_by_email=?,updated_at=CURRENT_TIMESTAMP WHERE enrolment_id=? AND status IN ('active','under_review')").run(note, actor.email, e.id); if (!changed.changes) throw new ProgrammeError("No releasable programme award was found.", 409);
      native.prepare("UPDATE programme_enrolments SET lock_version=lock_version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(e.id);
      native.prepare("UPDATE programme_certificates SET status='revoked' WHERE enrolment_id=?").run(e.id);
    } else if (action === "advance") {
      if (row.status !== "active" || row.current_term >= config.terms.length) throw new ProgrammeError("There is no next term to release for this active enrolment.", 409);
      if (config.enforceTermProgression && progress!.terms.slice(0, row.current_term).some(t => !t.complete)) throw new ProgrammeError("Complete the core and elective-credit requirements of the earlier terms first.", 409);
      if (note.length < 10) throw new ProgrammeError("Record the progression authority or decision note.");
      native.prepare("UPDATE programme_enrolments SET current_term=current_term+1,decision_note=?,lock_version=lock_version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(note, e.id);
    } else if (action === "graduate" || action === "confirm_award") {
      if (!progress!.eligible || !["active", "graduated"].includes(row.status)) throw new ProgrammeError("Programme completion is not yet eligible. " + progress!.blockers.join(" "), 409);
      const user = native.prepare("SELECT identity_status,status FROM users WHERE email=?").get(e.user_email) as { identity_status: string; status: string }; if (user.identity_status !== "verified" || user.status !== "active") throw new ProgrammeError("Verified learner identity is required before recording the award.", 409);
      if (action === "graduate") {
        const reference = cleanProgrammeText(payload.reference, 240), date = cleanProgrammeText(payload.awardDate, 10);
        if (reference.length < 3 || !validProgrammeDate(date) || note.length < 10) throw new ProgrammeError("Record the approved award reference, date and academic decision note.");
        native.prepare("INSERT INTO programme_awards(enrolment_id,reference,award_date,status,evidence_json,recorded_by_email) VALUES(?,?,?,'active',?,?)").run(e.id, reference, date, JSON.stringify({ config, progress, recordedAt: new Date().toISOString() }), actor.email);
        native.prepare("UPDATE programme_enrolments SET status='graduated',decision_note=?,lock_version=lock_version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(note, e.id);
      } else { if (note.length < 10) throw new ProgrammeError("Record the academic review decision."); const changed = native.prepare("UPDATE programme_awards SET status='active',review_note=?,evidence_json=?,recorded_by_email=?,updated_at=CURRENT_TIMESTAMP WHERE enrolment_id=? AND status IN ('under_review','revoked')").run(note, JSON.stringify({ config, progress }), actor.email, e.id); if (!changed.changes) throw new ProgrammeError("No award is awaiting reconfirmation.", 409); native.prepare("UPDATE programme_certificates SET status='active' WHERE enrolment_id=?").run(e.id); native.prepare("UPDATE programme_enrolments SET lock_version=lock_version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(e.id); }
    } else {
      const transitions: Record<string, { from: string[]; to: ProgrammeEnrolment["status"] }> = { reject: { from: ["applied"], to: "rejected" }, defer: { from: ["active"], to: "deferred" }, resume: { from: ["deferred"], to: "active" }, withdraw: { from: ["applied", "active", "deferred"], to: "withdrawn" } };
      const transition = Object.hasOwn(transitions, action) ? transitions[action] : undefined;
      if (!transition || !transition.from.includes(row.status)) throw new ProgrammeError("This enrolment cannot receive that decision.", 409);
      if (note.length < 10) throw new ProgrammeError("Record a reason for this enrolment decision."); status = transition.to;
      native.prepare("UPDATE programme_enrolments SET status=?,decision_note=?,lock_version=lock_version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(status, note, e.id);
    }
    programmeAudit(native, actor, action, { enrolmentId: e.id, programmeId: p.id, courseCode: payload.courseCode, reference: payload.reference, admissionReference: payload.admissionReference, studentNumber: payload.studentNumber, cohort: payload.cohort, feeCoverage: payload.feeCoverage, financialReference: payload.financialReference, mark: payload.mark, previousCredit, previousStatus: row.status, previousTerm: row.current_term, note });
    return e.id;
  });
}
export function programmeFailure(error: unknown) { if (error instanceof ProgrammeError) return Response.json({ error: error.message }, { status: error.status }); if (error instanceof Error && /UNIQUE constraint/.test(error.message)) return Response.json({ error: "This programme, student number, credit or award reference already exists. Refresh the record." }, { status: 409 }); console.error("Programme operation failed", error); return Response.json({ error: "The programme operation could not be completed." }, { status: 500 }); }
