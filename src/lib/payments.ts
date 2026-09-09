import { getRawDb } from "@/db/raw";

export type PaymentPurpose = "enrollment" | "certificate";

export type PaymentOrder = {
  reference: string;
  user_email: string;
  course_code: string;
  purpose: PaymentPurpose;
  amount_pesewas: number;
  currency: string;
  status: "pending" | "paid" | "failed";
};

type PaystackVerification = {
  status?: boolean;
  data?: {
    status?: string;
    reference?: string;
    amount?: number;
    currency?: string;
    paid_at?: string;
    customer?: { email?: string };
  };
};

export function paymentReference(purpose: PaymentPurpose) {
  return `UCC-${purpose === "enrollment" ? "ENR" : "CERT"}-${Date.now()}-${crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
}

export function publicOrigin(request?: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    try { return new URL(configured).origin; } catch { /* continue to request origin */ }
  }
  if (request) {
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
    if (forwardedHost && /^[a-z0-9.:-]+$/i.test(forwardedHost)) return `${forwardedProtocol === "http" ? "http" : "https"}://${forwardedHost}`;
    try { return new URL(request.url).origin; } catch { /* use production fallback */ }
  }
  return "https://ucc-microcredential-platform.onrender.com";
}

export async function paidOrder(userEmail: string, courseCode: string, purpose: PaymentPurpose) {
  return getRawDb().prepare("SELECT reference, user_email, course_code, purpose, amount_pesewas, currency, status FROM payment_orders WHERE user_email = ? AND course_code = ? AND purpose = ? AND status = 'paid' ORDER BY paid_at DESC, id DESC LIMIT 1")
    .bind(userEmail, courseCode, purpose).first<PaymentOrder>();
}

export async function settlePayment(reference: string, verification: PaystackVerification) {
  const db = getRawDb();
  const order = await db.prepare("SELECT reference, user_email, course_code, purpose, amount_pesewas, currency, status FROM payment_orders WHERE reference = ? LIMIT 1")
    .bind(reference).first<PaymentOrder>();
  if (!order) throw new Error("Payment order was not found.");
  if (order.status === "paid") return order;

  const data = verification?.data;
  const providerEmail = data?.customer?.email?.trim().toLowerCase();
  const valid = verification?.status === true
    && data?.status === "success"
    && data?.reference === order.reference
    && Number(data?.amount) === order.amount_pesewas
    && String(data?.currency || "").toUpperCase() === order.currency.toUpperCase()
    && providerEmail === order.user_email.toLowerCase();

  if (!valid) {
    await db.prepare("UPDATE payment_orders SET status = 'failed', provider_payload_json = ?, updated_at = CURRENT_TIMESTAMP WHERE reference = ? AND status = 'pending'")
      .bind(JSON.stringify({ status: data?.status, reference: data?.reference, amount: data?.amount, currency: data?.currency, customerEmail: providerEmail }), reference).run();
    throw new Error("The payment could not be validated against the order.");
  }

  const receipt = JSON.stringify({ reference: data?.reference, amount: data?.amount, currency: data?.currency, paidAt: data?.paid_at, customerEmail: providerEmail });
  await db.prepare("UPDATE payment_orders SET status = 'paid', provider_reference = ?, provider_payload_json = ?, paid_at = COALESCE(?, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE reference = ? AND status = 'pending'")
    .bind(data.reference, receipt, data.paid_at || null, reference).run();

  if (order.purpose === "enrollment") {
    await db.prepare("INSERT INTO enrollments (user_email, course_code, status, payment_status, payment_reference, amount_paid_pesewas) VALUES (?, ?, 'active', 'paid', ?, ?) ON CONFLICT(user_email, course_code) DO UPDATE SET status = CASE WHEN enrollments.status = 'withdrawn' THEN 'active' ELSE enrollments.status END, payment_status = 'paid', payment_reference = excluded.payment_reference, amount_paid_pesewas = excluded.amount_paid_pesewas")
      .bind(order.user_email, order.course_code, order.reference, order.amount_pesewas).run();
  }

  await db.prepare("INSERT INTO admin_audit_log (admin_email, action, details_json) VALUES (?, 'payment_confirmed', ?)")
    .bind("payments@system.ucc.edu.gh", JSON.stringify({ reference: order.reference, userEmail: order.user_email, courseCode: order.course_code, purpose: order.purpose, amountPesewas: order.amount_pesewas })).run();
  return { ...order, status: "paid" as const };
}
