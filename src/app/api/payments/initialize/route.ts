import { requireActiveProfile } from "@/lib/accounts";
import { issueCertificateIfComplete } from "@/lib/course-completion";
import { normalizeCourseDesign } from "@/lib/course-design";
import { getRawDb } from "@/db/raw";
import { paidOrder, paymentReference, publicOrigin, type PaymentPurpose } from "@/lib/payments";

export async function POST(request: Request) {
  const account = await requireActiveProfile(["learner"]);
  if (account.error || !account.profile) return account.error;
  const payload = await request.json() as { courseCode?: string; purpose?: PaymentPurpose };
  const courseCode = String(payload.courseCode || "").trim();
  const purpose: PaymentPurpose = payload.purpose === "certificate" ? "certificate" : "enrollment";
  const db = getRawDb();
  const course = await db.prepare("SELECT code, title, design_json, certificate_enabled, certificate_fee_ghs FROM course_drafts WHERE code = ? AND status = 'active' LIMIT 1")
    .bind(courseCode).first<{ code: string; title: string; design_json: string; certificate_enabled: number; certificate_fee_ghs: number }>();
  if (!course) return Response.json({ error: "This course is not currently available." }, { status: 404 });

  let rawDesign: unknown = {};
  try { rawDesign = JSON.parse(course.design_json || "{}"); } catch { rawDesign = {}; }
  const design = normalizeCourseDesign(rawDesign);
  const enrolment = await db.prepare("SELECT status FROM enrollments WHERE user_email = ? AND course_code = ? LIMIT 1")
    .bind(account.profile.email, course.code).first<{ status: string }>();

  let amountGhs = 0;
  if (purpose === "enrollment") {
    if (design.enrolmentMode !== "open") return Response.json({ error: design.enrolmentMode === "application" ? "This course requires an approved application." : "This course is available by invitation only." }, { status: 409 });
    if (enrolment && enrolment.status !== "withdrawn") return Response.json({ completed: true, enrolled: true, courseCode: course.code });
    amountGhs = Math.max(0, Math.round(design.priceGhs || 0));
    if (amountGhs === 0) {
      await db.prepare("INSERT INTO enrollments (user_email, course_code, status, payment_status) VALUES (?, ?, 'active', 'not_required') ON CONFLICT(user_email, course_code) DO UPDATE SET status = 'active', payment_status = 'not_required'")
        .bind(account.profile.email, course.code).run();
      return Response.json({ completed: true, enrolled: true, courseCode: course.code });
    }
  } else {
    if (!course.certificate_enabled) return Response.json({ error: "A digital certificate is not offered for this course." }, { status: 409 });
    if (!enrolment || enrolment.status === "withdrawn") return Response.json({ error: "Enrol in the course before requesting a certificate." }, { status: 409 });
    const completion = await issueCertificateIfComplete(account.profile.email, course.code);
    if (!completion.evaluation?.complete) return Response.json({ error: "Complete every required learning and assessment item before requesting a certificate.", completion: completion.evaluation }, { status: 409 });
    if (completion.certificate) return Response.json({ completed: true, certificate: completion.certificate });
    amountGhs = Math.max(0, Math.round(course.certificate_fee_ghs || 0));
    if (amountGhs === 0) {
      const issued = await issueCertificateIfComplete(account.profile.email, course.code);
      return Response.json({ completed: true, certificate: issued.certificate });
    }
  }

  const existingPaid = await paidOrder(account.profile.email, course.code, purpose);
  if (existingPaid) {
    if (purpose === "certificate") {
      const issued = await issueCertificateIfComplete(account.profile.email, course.code);
      return Response.json({ completed: true, certificate: issued.certificate });
    }
    return Response.json({ completed: true, enrolled: true, courseCode: course.code });
  }

  const secret = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!secret) return Response.json({ error: "Online payment is not configured. Please contact UCC support." }, { status: 503 });
  const reference = paymentReference(purpose);
  const amountPesewas = amountGhs * 100;
  await db.prepare("INSERT INTO payment_orders (reference, user_email, course_code, purpose, amount_pesewas, currency, provider, status) VALUES (?, ?, ?, ?, ?, 'GHS', 'paystack', 'pending')")
    .bind(reference, account.profile.email, course.code, purpose, amountPesewas).run();

  const callbackUrl = `${publicOrigin(request)}/api/payments/verify?reference=${encodeURIComponent(reference)}`;
  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email: account.profile.email, amount: amountPesewas, currency: "GHS", reference, callback_url: callbackUrl, metadata: { courseCode: course.code, courseTitle: course.title, purpose } }),
    cache: "no-store",
  });
  const result = await response.json() as { status?: boolean; message?: string; data?: { authorization_url?: string; access_code?: string } };
  if (!response.ok || !result.status || !result.data?.authorization_url) {
    await db.prepare("UPDATE payment_orders SET status = 'failed', provider_payload_json = ?, updated_at = CURRENT_TIMESTAMP WHERE reference = ?")
      .bind(JSON.stringify({ message: result.message || "Gateway initialization failed" }), reference).run();
    return Response.json({ error: result.message || "Payment could not be started." }, { status: 502 });
  }
  return Response.json({ authorizationUrl: result.data.authorization_url, reference, amountGhs, purpose });
}
