import { requireActiveProfile } from "@/lib/accounts";
import { amountForPurpose, getCoursePaymentTerms, paymentReference, type PaymentPurpose } from "@/lib/payments";
import { getRawDb } from "@/db/raw";

const appBaseUrl = (request: Request) => {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  return configured || new URL(request.url).origin;
};

export async function POST(request: Request) {
  const account = await requireActiveProfile(["learner"]);
  if (account.error || !account.profile) return account.error;
  const payload = await request.json() as { courseCode?: string; purpose?: PaymentPurpose };
  const courseCode = String(payload.courseCode ?? "").trim().toUpperCase();
  const purpose = payload.purpose;
  if (!courseCode || !purpose || !["enrollment", "certificate"].includes(purpose)) return Response.json({ error: "Choose a course and payment purpose." }, { status: 400 });
  const terms = await getCoursePaymentTerms(courseCode);
  if (!terms) return Response.json({ error: "This published course was not found." }, { status: 404 });
  if (terms.enrolmentMode !== "open") return Response.json({ error: "This course is not currently configured for self-enrolment." }, { status: 409 });
  if (purpose === "certificate") {
    const completed = await getRawDb().prepare("SELECT id FROM enrollments WHERE user_email = ? AND course_code = ? AND status = 'completed' LIMIT 1")
      .bind(account.profile.email, courseCode).first();
    if (!completed) return Response.json({ error: "Complete the academic course requirements before paying for a certificate." }, { status: 409 });
  }
  const amount = amountForPurpose(terms, purpose);
  if (amount < 1) return Response.json({ error: purpose === "enrollment" ? "This course is free; enrol directly." : "This certificate is free and does not require payment." }, { status: 409 });
  const secret = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!secret) return Response.json({ error: "Online payment is not configured. Contact UCC learner support." }, { status: 503 });
  const reference = paymentReference(purpose);
  await getRawDb().prepare("INSERT INTO payment_orders (reference, user_email, course_code, purpose, amount_pesewas, currency, provider, status) VALUES (?, ?, ?, ?, ?, 'GHS', 'paystack', 'initialized')")
    .bind(reference, account.profile.email, courseCode, purpose, amount).run();
  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
    body: JSON.stringify({
      email: account.profile.email,
      amount,
      currency: "GHS",
      reference,
      callback_url: `${appBaseUrl(request)}/?payment=verify`,
      metadata: { courseCode, purpose, learnerEmail: account.profile.email },
    }),
    cache: "no-store",
  });
  const result = await response.json() as { status?: boolean; message?: string; data?: { authorization_url?: string; access_code?: string; reference?: string } };
  if (!response.ok || !result.status || !result.data?.authorization_url || result.data.reference !== reference) {
    await getRawDb().prepare("UPDATE payment_orders SET status = 'failed', provider_data_json = ?, updated_at = CURRENT_TIMESTAMP WHERE reference = ?")
      .bind(JSON.stringify(result), reference).run();
    return Response.json({ error: result.message || "Payment could not be initialized." }, { status: 502 });
  }
  return Response.json({ authorizationUrl: result.data.authorization_url, accessCode: result.data.access_code, reference, amountPesewas: amount, currency: "GHS", purpose });
}
