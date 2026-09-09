import { requireActiveProfile } from "@/lib/accounts";
import { getRawDb } from "@/db/raw";
import { settlePaymentOrder, type PaymentOrder } from "@/lib/payments";

export async function POST(request: Request) {
  const account = await requireActiveProfile(["learner"]);
  if (account.error || !account.profile) return account.error;
  const payload = await request.json() as { reference?: string };
  const reference = String(payload.reference ?? "").trim();
  if (!/^UCC-(?:ENR|CERT)-[A-Za-z0-9-]+$/.test(reference)) return Response.json({ error: "A valid payment reference is required." }, { status: 400 });
  const order = await getRawDb().prepare("SELECT reference, user_email, course_code, purpose, amount_pesewas, currency, status FROM payment_orders WHERE reference = ? AND user_email = ? LIMIT 1")
    .bind(reference, account.profile.email).first<PaymentOrder>();
  if (!order) return Response.json({ error: "Payment order was not found." }, { status: 404 });
  if (order.status === "paid") return Response.json({ verified: true, courseCode: order.course_code, purpose: order.purpose });
  const secret = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!secret) return Response.json({ error: "Online payment is not configured." }, { status: 503 });
  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, { headers: { authorization: `Bearer ${secret}` }, cache: "no-store" });
  const result = await response.json() as { status?: boolean; message?: string; data?: { status?: string; reference?: string; amount?: number; currency?: string; customer?: { email?: string } } };
  const data = result.data;
  const valid = response.ok && result.status && data?.status === "success" && data.reference === order.reference && Number(data.amount) === order.amount_pesewas && data.currency === order.currency && data.customer?.email?.toLowerCase() === order.user_email.toLowerCase();
  if (!valid) return Response.json({ error: result.message || "Payment has not been verified. No access was granted." }, { status: 409 });
  const settled = await settlePaymentOrder(reference, result);
  if ("error" in settled) return Response.json({ error: settled.error }, { status: settled.status });
  return Response.json({ verified: true, courseCode: order.course_code, purpose: order.purpose });
}
