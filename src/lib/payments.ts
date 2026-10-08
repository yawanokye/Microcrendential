import { getRawDb } from "@/db/raw";
import { normalizeCourseDesign } from "@/lib/course-design";
import { enrolWithSnapshot } from "./course-access";
import { notify } from "./delivery-notifications";

export type PaymentPurpose = "enrollment" | "certificate";

export type PaymentOrder = {
  reference: string;
  user_email: string;
  course_code: string;
  purpose: PaymentPurpose;
  amount_pesewas: number;
  currency: string;
  status: string;
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

export async function settlePaymentOrder(reference: string, providerData: unknown) {
  const db = getRawDb();
  const order = await db.prepare("SELECT reference, user_email, course_code, purpose, amount_pesewas, currency, status FROM payment_orders WHERE reference = ? LIMIT 1")
    .bind(reference).first<PaymentOrder>();
  if (!order) return { error: "Payment order was not found.", status: 404 } as const;
  if (order.status !== "paid") {
    await db.prepare("UPDATE payment_orders SET status = 'paid', provider_data_json = ?, paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE reference = ? AND status <> 'paid'")
      .bind(JSON.stringify(providerData ?? {}), reference).run();
  }
  if (order.purpose === "enrollment") {
    const enrolled = enrolWithSnapshot(order.user_email,order.course_code);
    if (enrolled.error) { await notify(order.user_email,`paid-unenrolled-${reference}`,"payment","Payment received; enrolment needs support",`${reference}: ${enrolled.error}. Request support or a refund in your payment history.`,"/?view=payments"); return {error:enrolled.error,status:409} as const; }
  }
  if (order.purpose === "certificate") {
    const { issueCertificateIfComplete } = await import("@/lib/course-completion");
    await issueCertificateIfComplete(order.user_email, order.course_code);
  }
  await notify(order.user_email,`paid-${reference}`,"payment","Payment receipt available",`Payment ${reference} was verified. Your receipt is available in payment history.`,"/?view=payments");
  return { order: { ...order, status: "paid" } } as const;
}

export function paymentReference(purpose: PaymentPurpose) {
  const prefix = purpose === "enrollment" ? "ENR" : "CERT";
  return `UCC-${prefix}-${Date.now()}-${crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
}
