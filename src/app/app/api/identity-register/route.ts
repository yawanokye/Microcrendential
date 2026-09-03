import { getRawDb } from "@/db/raw";
import { requireActiveProfile } from "@/lib/accounts";

export async function GET() {
  const account = await requireActiveProfile(["admin", "facilitator"]);
  if (account.error || !account.profile) return account.error;
  const db = getRawDb();
  const sql = account.profile.role === "admin"
    ? "SELECT email, full_name, role, date_of_birth, gender, nationality, phone, address, id_type, id_last4, verifier_email, created_at FROM users WHERE identity_status = 'pending_review' ORDER BY setup_completed_at ASC"
    : "SELECT email, full_name, role, date_of_birth, gender, nationality, phone, address, id_type, id_last4, verifier_email, created_at FROM users WHERE identity_status = 'pending_review' AND verifier_email = ? ORDER BY setup_completed_at ASC";
  const statement = db.prepare(sql);
  const cases = account.profile.role === "admin" ? await statement.all() : await statement.bind(account.profile.email).all();
  return Response.json({ cases: cases.results, viewerRole: account.profile.role });
}
