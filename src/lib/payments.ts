import { getRawDb } from "@/db/raw";
import { normalizeCourseDesign } from "@/lib/course-design";
import { enrolWithSnapshotInTransaction } from "./course-access";
import { notify } from "./delivery-notifications";

export type PaymentPurpose = "enrollment" | "certificate";

export type PaymentOrder = {
  offering_kind?: "course"|"programme";
  programme_enrolment_id?: number|null;
  reference: string;
  user_email: string;
  course_code: string;
  purpose: PaymentPurpose;
  amount_pesewas: number;
  currency: string;
  status: string;
  fulfilment_status?: string;
};

const parseJson = (value: string) => { try { return JSON.parse(value || "{}"); } catch { return {}; } };

export async function getCoursePaymentTerms(courseCode: string) {
  const course = await getRawDb().prepare("SELECT code, title, design_json FROM course_drafts WHERE code = ? AND status = 'active' LIMIT 1")
    .bind(courseCode).first<{ code: string; title: string; design_json: string }>();
  if (!course) return null;
  const design = normalizeCourseDesign(parseJson(course.design_json));
  return {
    courseCode: course.code,
    courseTitle: course.title,
    enrolmentMode: design.enrolmentMode,
    enrolmentFeeGhs: design.priceGhs,
    certificateFeeGhs: design.certificateFeeGhs,
  };
}

export function amountForPurpose(terms: NonNullable<Awaited<ReturnType<typeof getCoursePaymentTerms>>>, purpose: PaymentPurpose) {
  const amountGhs = purpose === "enrollment" ? terms.enrolmentFeeGhs : terms.certificateFeeGhs;
  return Math.round(amountGhs * 100);
}

type CheckoutOrder = {reference:string; email:string; courseCode:string; purpose:PaymentPurpose; amount:number; kind:"course"|"programme"; programmeEnrolmentId?:number; billingSnapshot:string};

/** Reserve a limited-capacity seat and create its order in the same transaction. */
export function createCheckoutOrder(order:CheckoutOrder) {
  return getRawDb().transaction(db => {
    let expiresAt:string|null = null;
    if (order.kind === "course" && order.purpose === "enrollment") {
      const run = db.prepare("SELECT capacity,enrolment_closes_at FROM course_runs WHERE offering_code=?").get(order.courseCode) as {capacity:number;enrolment_closes_at:string|null}|undefined;
      if (run?.enrolment_closes_at && Date.parse(run.enrolment_closes_at) < Date.now()) throw new Error("Enrolment for this intake has closed.");
      if (run?.capacity) {
        const existing = db.prepare("SELECT status FROM enrollments WHERE user_email=? AND course_code=?").get(order.email,order.courseCode) as {status:string}|undefined;
        if (existing) throw new Error(existing.status === "withdrawn" ? "Contact learner support to reopen a withdrawn enrolment." : "You are already enrolled in this intake.");
        const prior = db.prepare("SELECT reference FROM payment_seat_reservations WHERE course_code=? AND user_email=? AND released_at IS NULL AND datetime(expires_at)>datetime('now') LIMIT 1").get(order.courseCode,order.email);
        if (prior) throw new Error("A checkout is already holding your place. Complete or verify that payment, or try again after the hold expires.");
        const enrolled = db.prepare("SELECT COUNT(*) n FROM enrollments WHERE course_code=? AND status IN ('active','completed')").get(order.courseCode) as {n:number};
        const held = db.prepare(`SELECT COUNT(DISTINCT r.user_email) n FROM payment_seat_reservations r WHERE r.course_code=? AND r.released_at IS NULL AND datetime(r.expires_at)>datetime('now') AND NOT EXISTS (SELECT 1 FROM enrollments e WHERE e.course_code=r.course_code AND e.user_email=r.user_email AND e.status IN ('active','completed'))`).get(order.courseCode) as {n:number};
        if (enrolled.n + held.n >= run.capacity) throw new Error("This intake has reached its capacity.");
        expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
        db.prepare("INSERT INTO payment_seat_reservations(reference,course_code,user_email,expires_at) VALUES(?,?,?,?)").run(order.reference,order.courseCode,order.email,expiresAt);
      }
    }
    db.prepare("INSERT INTO payment_orders(reference,user_email,course_code,purpose,amount_pesewas,offering_kind,programme_enrolment_id,billing_snapshot_json,currency,provider,status,fulfilment_status) VALUES(?,?,?,?,?,?,?,?,'GHS','paystack','initialized','pending')").run(order.reference,order.email,order.courseCode,order.purpose,order.amount,order.kind,order.kind === "programme" ? order.programmeEnrolmentId || null : null,order.billingSnapshot);
    return {expiresAt};
  });
}

export function failCheckoutOrder(reference:string, details:unknown) {
  getRawDb().transaction(db => {
    const changed=db.prepare("UPDATE payment_orders SET status='failed',provider_data_json=?,updated_at=CURRENT_TIMESTAMP WHERE reference=? AND status='initialized'").run(JSON.stringify(details ?? {}),reference);
    if (changed.changes) db.prepare("UPDATE payment_seat_reservations SET released_at=CURRENT_TIMESTAMP WHERE reference=? AND released_at IS NULL").run(reference);
  });
}

export async function settlePaymentOrder(reference: string, providerData: unknown) {
  const db = getRawDb();
  const settlement = db.transaction(native => {
    const order = native.prepare("SELECT reference,user_email,course_code,purpose,amount_pesewas,currency,status,offering_kind,programme_enrolment_id,fulfilment_status FROM payment_orders WHERE reference=? LIMIT 1").get(reference) as PaymentOrder|undefined;
    if (!order) return {error:"Payment order was not found.",status:404} as const;
    if (order.status !== "paid") native.prepare("UPDATE payment_orders SET status='paid',provider_data_json=?,paid_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE reference=? AND status<>'paid'").run(JSON.stringify(providerData ?? {}),reference);
    if (order.fulfilment_status === "fulfilled") return {order:{...order,status:"paid"},fulfilled:true} as const;
    const refund=native.prepare("SELECT status FROM refund_requests WHERE payment_reference=? AND status IN ('requested','approved','completed') LIMIT 1").get(reference) as {status:string}|undefined;
    if (refund) {
      const reason="A refund request is under review or has been processed. Contact learner support.";
      native.prepare("UPDATE payment_orders SET fulfilment_status='refund_pending',fulfilment_error=?,fulfilment_attempted_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE reference=?").run(reason,reference);
      return {order:{...order,status:"paid"},fulfilled:false,reason} as const;
    }
    if (order.offering_kind !== "programme" && order.purpose === "enrollment") {
      const user = native.prepare("SELECT status FROM users WHERE email=? AND role='learner'").get(order.user_email) as {status:string}|undefined;
      const enrolled = user?.status === "active" ? enrolWithSnapshotInTransaction(native,order.user_email,order.course_code) : {error:"The learner account needs an administrator review."};
      if (enrolled.error) {
        native.prepare("UPDATE payment_orders SET fulfilment_status='pending',fulfilment_error=?,fulfilment_attempted_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE reference=?").run(enrolled.error,reference);
        return {order:{...order,status:"paid"},fulfilled:false,reason:enrolled.error} as const;
      }
    }
    native.prepare("UPDATE payment_orders SET fulfilment_status='fulfilled',fulfilment_error=NULL,fulfilment_attempted_at=CURRENT_TIMESTAMP,fulfilled_at=COALESCE(fulfilled_at,CURRENT_TIMESTAMP),updated_at=CURRENT_TIMESTAMP WHERE reference=?").run(reference);
    native.prepare("UPDATE payment_seat_reservations SET released_at=CURRENT_TIMESTAMP WHERE reference=? AND released_at IS NULL").run(reference);
    return {order:{...order,status:"paid"},fulfilled:true} as const;
  });
  if ("error" in settlement) return settlement;
  const {order} = settlement;
  if (!settlement.fulfilled) {
    await notify(order.user_email,`paid-unenrolled-${reference}`,"payment","Payment received; enrolment needs support",`${reference}: ${settlement.reason}. Request support or a refund in your payment history.`,"/?view=payments");
    return settlement;
  }
  if(order.offering_kind==="programme"){if(order.programme_enrolment_id)await (await import("./programme-credentials")).synchroniseProgrammeCredential(order.programme_enrolment_id);}
  if (order.offering_kind!=="programme" && order.purpose === "certificate") {
    const { issueCertificateIfComplete } = await import("@/lib/course-completion");
    await issueCertificateIfComplete(order.user_email, order.course_code);
  }
  await notify(order.user_email,`paid-${reference}`,"payment","Payment receipt available",`Payment ${reference} was verified. Your receipt is available in payment history.`,"/?view=payments");
  return settlement;
}

/** Retry only new, explicitly pending paid enrolments in small batches. */
export async function reconcilePendingPayments() {
  const rows = await getRawDb().prepare("SELECT reference FROM payment_orders WHERE status='paid' AND fulfilment_status='pending' AND offering_kind='course' AND purpose='enrollment' AND (fulfilment_attempted_at IS NULL OR datetime(fulfilment_attempted_at)<=datetime('now','-5 minutes')) ORDER BY id LIMIT 20").all<{reference:string}>();
  for (const row of rows.results) { try { await settlePaymentOrder(row.reference,{}); } catch (error) { console.error("Payment reconciliation will retry.",error); } }
  return rows.results.length;
}

export function paymentReference(purpose: PaymentPurpose) {
  const prefix = purpose === "enrollment" ? "ENR" : "CERT";
  return `UCC-${prefix}-${Date.now()}-${crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
}
