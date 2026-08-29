import { getRawDb } from "@/db/raw";
import { requireActiveProfile } from "@/lib/accounts";

export async function POST(request: Request) {
  const account = await requireActiveProfile(["admin", "facilitator"]);
  if (account.error || !account.profile) return account.error;
  const payload = await request.json() as { email?: string; decision?: "approve" | "reject"; note?: string };
  const email = payload.email?.trim().toLowerCase() ?? "";
  if (!email || !["approve", "reject"].includes(payload.decision ?? "")) return Response.json({ error: "A valid verification decision is required." }, { status: 400 });
  const status = payload.decision === "approve" ? "active" : "rejected";
  const identityStatus = payload.decision === "approve" ? "verified" : "rejected";
  const sql = account.profile.role === "admin"
    ? "UPDATE users SET status = CASE WHEN status = 'pending_verification' THEN ? ELSE status END, identity_status = ?, verification_note = ?, reviewed_by_email = ?, reviewed_at = CURRENT_TIMESTAMP WHERE email = ? AND identity_status = 'pending_review'"
    : "UPDATE users SET status = CASE WHEN status = 'pending_verification' THEN ? ELSE status END, identity_status = ?, verification_note = ?, reviewed_by_email = ?, reviewed_at = CURRENT_TIMESTAMP WHERE email = ? AND identity_status = 'pending_review' AND verifier_email = ?";
  const statement = getRawDb().prepare(sql);
  const result = account.profile.role === "admin"
    ? await statement.bind(status, identityStatus, payload.note?.trim() ?? "", account.profile.email, email).run()
    : await statement.bind(status, identityStatus, payload.note?.trim() ?? "", account.profile.email, email, account.profile.email).run();
  if (!result.meta.changes) return Response.json({ error: "This verification request is no longer pending." }, { status: 409 });
  return Response.json({ updated: true, email, status, identityStatus });
}
