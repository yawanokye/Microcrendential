import { getRawDb } from "@/db/raw";
import { requireActiveProfile } from "@/lib/accounts";
import { sendTransactionalEmail } from "@/lib/email";
import { recordAudit } from "@/lib/audit";
import { rejectCrossSiteMutation } from "@/lib/request-security";

export async function GET() {
  const account = await requireActiveProfile(["admin"]);
  if (account.error) return account.error;
  const db = getRawDb();
  const facilitators = await db.prepare("SELECT email, full_name, organisation, status, identity_status, created_at FROM users WHERE role = 'facilitator' ORDER BY created_at DESC").all<{ email: string; full_name: string; organisation: string | null; status: string; identity_status: string; created_at: string }>();
  const verifications = await db.prepare("SELECT email, full_name, role, date_of_birth, gender, nationality, phone, id_type, id_last4, status, verifier_email, created_at FROM users WHERE identity_status = 'pending_review' ORDER BY setup_completed_at ASC").all();
  const reviewers = await db.prepare("SELECT email, full_name, role FROM users WHERE status = 'active' AND role IN ('admin', 'facilitator') ORDER BY role, full_name").all();
  const counts = await db.prepare("SELECT role, COUNT(*) AS total FROM users GROUP BY role").all<{ role: string; total: number }>();
  return Response.json({ facilitators: facilitators.results, verifications: verifications.results, reviewers: reviewers.results, counts: Object.fromEntries(counts.results.map((row) => [row.role, row.total])) });
}

export async function POST(request: Request) {
  const origin = rejectCrossSiteMutation(request);
  if (origin) return origin;
  const account = await requireActiveProfile(["admin"]);
  if (account.error || !account.profile) return account.error;
  const payload = await request.json() as { email?: string; fullName?: string; institution?: string };
  const email = payload.email?.trim().toLowerCase() ?? "";
  const fullName = payload.fullName?.trim() ?? "";
  const institution = payload.institution?.trim() ?? "";
  if (!/^\S+@\S+\.\S+$/.test(email) || !fullName || !institution) return Response.json({ error: "A valid professional email, full name and institutional affiliation are required." }, { status: 400 });
  const token = `${crypto.randomUUID()}${crypto.randomUUID().replaceAll("-", "")}`;
  const tokenHash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)))).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  try {
    await getRawDb().prepare("INSERT INTO users (email, full_name, organisation, role, status, identity_status, invite_token_hash, invite_expires_at, created_by_email) VALUES (?, ?, ?, 'facilitator', 'pending_setup', 'not_submitted', ?, ?, ?)")
      .bind(email, fullName, institution, tokenHash, expiresAt, account.profile.email).run();
  } catch {
    return Response.json({ error: "An account already exists for this email address." }, { status: 409 });
  }
  // Return an application-relative URL so the browser uses the public Render
  // hostname instead of the container's internal 0.0.0.0 address.
  const invitePath = `/facilitator-signin?invite=${encodeURIComponent(token)}`;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || new URL(request.url).origin;
  const inviteUrl = `${baseUrl}${invitePath}`;
  let emailSent = false;
  try {
    await sendTransactionalEmail({
      to: email,
      subject: "UCC Growth+ facilitator invitation",
      heading: "You have been invited as a facilitator",
      text: `${fullName}, you have been invited to develop and facilitate learning on UCC Growth+ on behalf of ${institution}. This invitation is bound to your professional email and expires in seven days.`,
      actionUrl: inviteUrl,
      actionLabel: "Complete facilitator setup",
    });
    emailSent = true;
  } catch (error) {
    console.error("Facilitator invitation email failed", error);
  }
  await recordAudit(account.profile.email, "facilitator.invited", { email, institution, emailSent, expiresAt });
  return Response.json({ facilitator: { email, fullName, institution, status: "pending_setup" }, inviteUrl: invitePath, expiresAt, emailSent }, { status: 201 });
}
