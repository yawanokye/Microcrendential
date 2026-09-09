import { requireActiveProfile } from "@/lib/accounts";
import { issueCertificateIfComplete } from "@/lib/course-completion";
import { getRawDb } from "@/db/raw";
import { publicOrigin, settlePayment, type PaymentOrder } from "@/lib/payments";

export async function GET(request: Request) {
  const account = await requireActiveProfile(["learner"]);
  const origin = publicOrigin(request);
  if (account.error || !account.profile) return Response.redirect(`${origin}/student-signin`, 303);
  const url = new URL(request.url);
  const reference = String(url.searchParams.get("reference") || url.searchParams.get("trxref") || "").trim();
  if (!reference) return Response.redirect(`${origin}/?payment=failed&reason=missing_reference`, 303);
  const order = await getRawDb().prepare("SELECT reference, user_email, course_code, purpose, amount_pesewas, currency, status FROM payment_orders WHERE reference = ? AND user_email = ? LIMIT 1")
    .bind(reference, account.profile.email).first<PaymentOrder>();
  if (!order) return Response.redirect(`${origin}/?payment=failed&reason=unknown_order`, 303);
  try {
    if (order.status !== "paid") {
      const secret = process.env.PAYSTACK_SECRET_KEY?.trim();
      if (!secret) throw new Error("Payment service is not configured.");
      const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${secret}` }, cache: "no-store" });
      const verification = await response.json();
      if (!response.ok) throw new Error("Payment verification failed.");
      await settlePayment(reference, verification);
    }
    if (order.purpose === "certificate") await issueCertificateIfComplete(order.user_email, order.course_code);
    return Response.redirect(`${origin}/?payment=success&purpose=${order.purpose}&course=${encodeURIComponent(order.course_code)}`, 303);
  } catch {
    return Response.redirect(`${origin}/?payment=failed&reason=verification_failed`, 303);
  }
}
