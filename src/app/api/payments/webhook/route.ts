import { createHmac, timingSafeEqual } from "node:crypto";
import { getRawDb } from "@/db/raw";
import { settlePaymentOrder, type PaymentOrder } from "@/lib/payments";

export async function POST(request: Request) {
  const secret = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!secret) return Response.json({ error: "Payment webhook is not configured." }, { status: 503 });
  const raw = Buffer.from(await request.arrayBuffer());
  const signature = request.headers.get("x-paystack-signature") ?? "";
  const expected = createHmac("sha512", secret).update(raw).digest("hex");
  const validSignature = signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!validSignature) return Response.json({ error: "Invalid webhook signature." }, { status: 401 });
  const event = JSON.parse(raw.toString("utf8")) as { event?: string; data?: { status?: string; reference?: string; amount?: number; currency?: string; customer?: { email?: string } } };
  if (event.event !== "charge.success" || !event.data?.reference) return Response.json({ received: true });
  const order = await getRawDb().prepare("SELECT reference, user_email, course_code, purpose, amount_pesewas, currency, status FROM payment_orders WHERE reference = ? LIMIT 1")
    .bind(event.data.reference).first<PaymentOrder>();
  if (!order) return Response.json({ received: true });
  const valid = event.data.status === "success" && event.data.reference === order.reference && Number(event.data.amount) === order.amount_pesewas && event.data.currency === order.currency && event.data.customer?.email?.toLowerCase() === order.user_email.toLowerCase();
  if (!valid) return Response.json({ error: "Payment details did not match the order." }, { status: 409 });
  await settlePaymentOrder(order.reference, event);
  return Response.json({ received: true });
}
