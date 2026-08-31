import { getRawDb } from "@/db/raw";
import { requireActiveProfile } from "@/lib/accounts";

export async function GET() {
  const account = await requireActiveProfile(["admin"]);
  if (account.error) return account.error;
  const db = getRawDb();
  const facilitators = await db.prepare("SELECT email, full_name, status, identity_status, created_at FROM users WHERE role = 'facilitator' ORDER BY created_at DESC").all<{ email: string; full_name: string; status: string; identity_status: string; created_at: string }>();
  const verifications = await db.prepare("SELECT email, full_name, role, date_of_birth, gender, nationality, phone, id_type, id_last4, status, verifier_email, created_at FROM users WHERE identity_status = 'pending_review' ORDER BY setup_completed_at ASC").all();
  const reviewers = await db.prepare("SELECT email, full_name, role FROM users WHERE status = 'active' AND role IN ('admin', 'facilitator') ORDER BY role, full_name").all();
  const counts = await db.prepare("SELECT role, COUNT(*) AS total FROM users GROUP BY role").all<{ role: string; total: number }>();
  return Response.json({ facilitators: facilitators.results, verifications: verifications.results, reviewers: reviewers.results, counts: Object.fromEntries(counts.results.map((row) => [row.role, row.total])) });
}

export async function POST(request: Request) {
  const account = await requireActiveProfile(["admin"]);
  if (account.error || !account.profile) return account.error;
  const payload = await request.json() as { email?: string; fullName?: string };
  const email = payload.email?.trim().toLowerCase() ?? "";
  const fullName = payload.fullName?.trim() ?? "";
  if (!/^\S+@\S+\.\S+$/.test(email) || !fullName) return Response.json({ error: "A valid email address and full name are required." }, { status: 400 });
  const token = `${crypto.randomUUID()}${crypto.randomUUID().replaceAll("-", "")}`;
  const tokenHash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)))).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  try {
    await getRawDb().prepare("INSERT INTO users (email, full_name, role, status, identity_status, invite_token_hash, invite_expires_at, created_by_email) VALUES (?, ?, 'facilitator', 'pending_setup', 'not_submitted', ?, ?, ?)")
      .bind(email, fullName, tokenHash, expiresAt, account.profile.email).run();
  } catch {
    return Response.json({ error: "An account already exists for this email address." }, { status: 409 });
  }
  // Return an application-relative URL so the browser uses the public Render
  // hostname instead of the container's internal 0.0.0.0 address.
  const invitePath = `/?invite=${encodeURIComponent(token)}`;
  return Response.json({ facilitator: { email, fullName, status: "pending_setup" }, inviteUrl: invitePath, expiresAt }, { status: 201 });
}
