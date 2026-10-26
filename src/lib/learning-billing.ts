import type { DatabaseSync } from "node:sqlite";
import { getRawDb } from "@/db/raw";
import { emptyBillingTerms, type BillingTerms, type OfferingKind, type FeePurpose } from "./catalogue-policy";

const parsed = <T>(s: string | null | undefined, fallback: T): T => { try { return JSON.parse(s || "") as T; } catch { return fallback; } };
export function currentBillingNative(db: DatabaseSync, kind: OfferingKind, code: string): BillingTerms {
  const row = db.prepare("SELECT * FROM offering_billing WHERE offering_kind=? AND offering_code=?").get(kind, code) as {enrollment_pesewas:number;certificate_pesewas:number;enrollment_payer:"individual"|"organisation";certificate_payer:"individual"|"organisation";includes_course_fees:number;version:number}|undefined;
  if (row) return { enrollmentPesewas: row.enrollment_pesewas, certificatePesewas: row.certificate_pesewas, enrollmentPayer: row.enrollment_payer, certificatePayer: row.certificate_payer, includesCourseFees: Boolean(row.includes_course_fees), version: row.version, managed: true };
  const design = kind === "course" ? parsed<{priceGhs?:number;certificateFeeGhs?:number}>((db.prepare("SELECT design_json FROM course_drafts WHERE code=? LIMIT 1").get(code) as {design_json:string}|undefined)?.design_json, {}) : {};
  return { ...emptyBillingTerms(), enrollmentPesewas: Math.round(Math.max(0, Number(design.priceGhs) || 0) * 100), certificatePesewas: Math.round(Math.max(0, Number(design.certificateFeeGhs) || 0) * 100) };
}
export function learnerBillingNative(db: DatabaseSync, kind: OfferingKind, code: string, email?: string, programmeEnrolmentId?: number): BillingTerms {
  if (!email) return currentBillingNative(db, kind, code);
  if (kind === "programme") { const e = db.prepare("SELECT billing_snapshot_json FROM programme_enrolments WHERE user_email=? AND programme_code=?" + (programmeEnrolmentId ? " AND id=?" : "") + " LIMIT 1").get(...(programmeEnrolmentId ? [email, code, programmeEnrolmentId] : [email, code])) as {billing_snapshot_json:string|null}|undefined; return e ? parsed(e.billing_snapshot_json, emptyBillingTerms()) : currentBillingNative(db, kind, code); }
  const e = db.prepare("SELECT billing_snapshot_json,course_snapshot_json FROM enrollments WHERE user_email=? AND course_code=?").get(email, code) as {billing_snapshot_json:string|null;course_snapshot_json:string|null}|undefined;
  if (!e) return currentBillingNative(db, kind, code);
  if (e.billing_snapshot_json) return parsed(e.billing_snapshot_json, currentBillingNative(db, kind, code));
  const snapshot = parsed<{design_json?:string}>(e.course_snapshot_json, {}); if (!snapshot.design_json) return currentBillingNative(db, kind, code); const design = parsed<{priceGhs?:number;certificateFeeGhs?:number}>(snapshot.design_json, {});
  return { ...emptyBillingTerms(), enrollmentPesewas: Math.round(Math.max(0, Number(design.priceGhs) || 0) * 100), certificatePesewas: Math.round(Math.max(0, Number(design.certificateFeeGhs) || 0) * 100) };
}
export function organisationCoverageNative(db: DatabaseSync, kind: OfferingKind, code: string, purpose: FeePurpose, email: string) {
  return db.prepare("SELECT i.id,i.reference,i.terms_json FROM learning_invoices i JOIN learning_invoice_members m ON m.invoice_id=i.id WHERE i.offering_kind=? AND i.offering_code=? AND i.purpose=? AND m.user_email=? AND i.status='issued' AND COALESCE((SELECT SUM(a.amount_pesewas) FROM organisation_receipt_allocations a WHERE a.invoice_id=i.id),0)>=i.total_pesewas ORDER BY i.id DESC LIMIT 1").get(kind, code, purpose, email) as {id:number;reference:string;terms_json:string}|undefined;
}
export function feeStateNative(db: DatabaseSync, kind: OfferingKind, code: string, purpose: FeePurpose, email: string, programmeEnrolmentId?: number) {
  const terms = learnerBillingNative(db, kind, code, email, programmeEnrolmentId), amountPesewas = purpose === "enrollment" ? terms.enrollmentPesewas : terms.certificatePesewas, payer = purpose === "enrollment" ? terms.enrollmentPayer : terms.certificatePayer;
  const funding = organisationCoverageNative(db, kind, code, purpose, email);
  const paid = db.prepare("SELECT reference,billing_snapshot_json FROM payment_orders WHERE user_email=? AND course_code=? AND offering_kind=? AND purpose=? AND status='paid'" + (kind === "programme" && programmeEnrolmentId ? " AND programme_enrolment_id=?" : "") + " ORDER BY id DESC LIMIT 1").get(...(kind === "programme" && programmeEnrolmentId ? [email, code, kind, purpose, programmeEnrolmentId] : [email, code, kind, purpose])) as {reference:string;billing_snapshot_json:string|null}|undefined;
  return { terms, amountPesewas, amountGhs: amountPesewas / 100, payer, satisfied: amountPesewas === 0 || Boolean(funding || paid), fundingReference: funding?.reference || paid?.reference || null, fundingSnapshot: funding ? parsed<BillingTerms>(funding.terms_json, terms) : paid?.billing_snapshot_json ? parsed<BillingTerms>(paid.billing_snapshot_json, terms) : null, fundedByOrganisation: Boolean(funding), requiresOrganisation: !funding && !paid && amountPesewas > 0 && payer === "organisation" };
}
export function feeState(kind: OfferingKind, code: string, purpose: FeePurpose, email: string, programmeEnrolmentId?: number) { return getRawDb().read(db => feeStateNative(db, kind, code, purpose, email, programmeEnrolmentId)); }
export function learnerFinance(kind: OfferingKind, code: string, email: string, enrolmentId?: number) { return { enrollment: feeState(kind, code, "enrollment", email, enrolmentId), certificate: feeState(kind, code, "certificate", email, enrolmentId) }; }

/** Retry bounded batches after organisation funding, without changing academic decisions. */
export async function reviewFundedCourseCredentials(){
 const db=getRawDb(),batch=await db.prepare("SELECT e.user_email,e.course_code FROM enrollments e LEFT JOIN certificates c ON c.user_email=e.user_email AND c.course_code=e.course_code WHERE e.status IN ('active','completed') AND c.id IS NULL AND EXISTS(SELECT 1 FROM learning_invoices i JOIN learning_invoice_members m ON m.invoice_id=i.id WHERE i.offering_kind='course' AND i.offering_code=e.course_code AND i.purpose='certificate' AND i.status='issued' AND m.user_email=e.user_email AND COALESCE((SELECT SUM(amount_pesewas) FROM organisation_receipt_allocations WHERE invoice_id=i.id),0)>=i.total_pesewas) ORDER BY COALESCE(e.funded_certificate_checked_at,'1970-01-01'),e.id LIMIT 25").all<{user_email:string;course_code:string}>();
 for(const row of batch.results){try{await (await import("./course-completion")).issueCertificateIfComplete(row.user_email,row.course_code);}catch(error){console.error("Funded certificate issuance will retry.",error);}await db.prepare("UPDATE enrollments SET funded_certificate_checked_at=CURRENT_TIMESTAMP WHERE user_email=? AND course_code=?").bind(row.user_email,row.course_code).run();}
 return batch.results.length;
}
/** Preserve legacy learners who enrolled before curriculum snapshots existed. */
export function snapshotUnpinnedCourseBillingNative(db:DatabaseSync,code:string,terms:BillingTerms){
 db.prepare("UPDATE enrollments SET billing_snapshot_json=? WHERE course_code=? AND billing_snapshot_json IS NULL AND (CASE WHEN json_valid(course_snapshot_json) THEN json_extract(course_snapshot_json,'$.design_json') ELSE NULL END) IS NULL").run(JSON.stringify(terms),code);
}
