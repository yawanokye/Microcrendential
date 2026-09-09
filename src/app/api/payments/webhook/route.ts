import { createHmac, timingSafeEqual } from "node:crypto";
import { issueCertificateIfComplete } from "@/lib/course-completion";
import { settlePayment } from "@/lib/payments";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!secret) return Response.json({ error: "Payment webhook is not configured." }, { status: 503 });
  const body = await request.text();
  const supplied = request.headers.get("x-paystack-signature") || "";
  const expected = createHmac("sha512", secret).update(body).digest("hex");
  const suppliedBuffer = Buffer.from(supplied, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (suppliedBuffer.length !== expectedBuffer.length || !timingSafeEqual(suppliedBuffer, expectedBuffer)) return Response.json({ error: "Invalid signature." }, { status: 401 });
  const event = JSON.parse(body) as { event?: string; data?: { reference?: string } } & Record<string, unknown>;
  if (event.event === "charge.success" && event.data?.reference) {
    try {
      const order = await settlePayment(event.data.reference, { status: true, data: event.data });
      if (order.purpose === "certificate") await issueCertificateIfComplete(order.user_email, order.course_code);
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : "Payment settlement failed." }, { status: 400 });
    }
  }
  return Response.json({ received: true });
}
