import { audienceAllowed } from "@/lib/catalogue-access";
import { feeState } from "@/lib/learning-billing";
import { getProgrammeEnrolment, checkProgrammeCourseCheckout, programmeStudyRecord } from "@/lib/programmes";
import { requireActiveProfile } from "@/lib/accounts";
import { getCoursePaymentTerms, paymentReference, type PaymentPurpose } from "@/lib/payments";
import { getRawDb } from "@/db/raw";
import { rejectCrossSiteMutation } from "@/lib/request-security";
import { paymentsEnabled } from "@/lib/runtime-config";

const appBaseUrl = (request: Request) => {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  return configured || new URL(request.url).origin;
};

export async function POST(request: Request) {
  const origin = rejectCrossSiteMutation(request);
  if (origin) return origin;
  if (!paymentsEnabled()) return Response.json({ error: "Online payment is disabled for the official pilot." }, { status: 503 });
  const account = await requireActiveProfile(["learner"]);
  if (account.error || !account.profile) return account.error;
  const payload = await request.json() as { courseCode?: string; purpose?: PaymentPurpose; kind?: string; programmeEnrolmentId?: number };
  const courseCode = String(payload.courseCode ?? "").trim().toUpperCase();
  const purpose = payload.purpose;
  if (!courseCode || !purpose || !["enrollment", "certificate"].includes(purpose)) return Response.json({ error: "Choose a course and payment purpose." }, { status: 400 });
  const kind=payload.kind==="programme"?"programme":"course", enrolmentId=Number(payload.programmeEnrolmentId)||undefined;
  if (!audienceAllowed(kind,courseCode,account.profile)) return Response.json({error:"Offering not found."},{status:404});
  if(kind==="programme"){
    try{if(!enrolmentId)throw new Error("An admitted programme enrolment is required.");const {enrolment,programme}=await getProgrammeEnrolment(enrolmentId,account.profile);if(programme.code!==courseCode||!["active","graduated"].includes(enrolment.status))throw new Error("An admitted programme enrolment is required.");if(purpose==="certificate"&&!(await programmeStudyRecord(enrolment,programme)).eligible)throw new Error("Complete the academic programme requirements before certificate payment.");}catch(error){return Response.json({error:error instanceof Error?error.message:"Programme enrolment not found."},{status:409});}
  }else{
    const terms=await getCoursePaymentTerms(courseCode);if(!terms)return Response.json({error:"This published course was not found."},{status:404});
    if(terms.enrolmentMode!=="open"){
      if(!enrolmentId)return Response.json({error:"Pay through your admitted programme workspace."},{status:409});
      try{await checkProgrammeCourseCheckout(account.profile,enrolmentId,courseCode);}catch(error){return Response.json({error:error instanceof Error?error.message:"Admitted curriculum access is required."},{status:403});}
    }
    if(purpose==="certificate"){const completed=await getRawDb().prepare("SELECT id FROM enrollments WHERE user_email=? AND course_code=? AND status='completed'").bind(account.profile.email,courseCode).first();if(!completed)return Response.json({error:"Complete the academic course requirements before paying for a certificate."},{status:409});}
  }
  const finance=feeState(kind,courseCode,purpose,account.profile.email,kind==="programme"?enrolmentId:undefined);
  if(finance.satisfied)return Response.json({error:"This fee is already covered or waived. Refresh your learning workspace."},{status:409});
  if(finance.requiresOrganisation)return Response.json({error:"The administrator has assigned this fee to your organisation. Contact your training coordinator; individual checkout is not required."},{status:409});
  const amount=finance.amountPesewas;
  const secret = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!secret) return Response.json({ error: "Online payment is not configured. Contact UCC learner support." }, { status: 503 });
  const reference = paymentReference(purpose);
  await getRawDb().prepare("INSERT INTO payment_orders (reference, user_email, course_code, purpose, amount_pesewas, offering_kind, programme_enrolment_id, billing_snapshot_json, currency, provider, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'GHS', 'paystack', 'initialized')")
    .bind(reference, account.profile.email, courseCode, purpose, amount,kind,kind==="programme"?enrolmentId||null:null,JSON.stringify(finance.terms)).run();
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
