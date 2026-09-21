import { requireActiveProfile } from "@/lib/accounts";
import { recordAudit } from "@/lib/audit";
import { sendTransactionalEmail } from "@/lib/email";
import { getRawDb } from "@/db/raw";
import { rejectCrossSiteMutation } from "@/lib/request-security";

export async function POST(request: Request) {
  const origin = rejectCrossSiteMutation(request);
  if (origin) return origin;
  const account = await requireActiveProfile();
  if (account.error || !account.profile) return account.error;
  const payload = await request.json() as { category?: string; message?: string };
  const category = payload.category?.trim().slice(0, 80) ?? "";
  const message = payload.message?.trim().slice(0, 5000) ?? "";
  if (!category || message.length < 10) return Response.json({ error: "Choose a category and describe the issue in at least 10 characters." }, { status: 400 });
  const created = await getRawDb().prepare("INSERT INTO support_requests (requester_email,requester_role,category,message) VALUES (?,?,?,?)")
    .bind(account.profile.email, account.profile.role, category, message).run();
  const reference = `UGP-${String(created.meta.last_row_id).padStart(6, "0")}`;
  await recordAudit(account.profile.email, "support.requested", { reference, category });
  const supportEmail = process.env.SUPPORT_EMAIL?.trim();
  let notified = false;
  if (supportEmail) {
    try {
      await sendTransactionalEmail({ to: supportEmail, subject: `[${reference}] UCC Growth+ support request`, heading: "New platform support request", text: `Reference: ${reference}\nRequester: ${account.profile.full_name} (${account.profile.email})\nRole: ${account.profile.role}\nCategory: ${category}\n\n${message}` });
      notified = true;
    } catch (error) { console.error("Support notification email failed", error); }
  }
  return Response.json({ submitted: true, reference, notified }, { status: 201 });
}
