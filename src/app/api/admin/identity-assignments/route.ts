import { getRawDb } from "@/db/raw";
import { requireActiveProfile } from "@/lib/accounts";

export async function POST(request: Request) {
  const account = await requireActiveProfile(["admin"]);
  if (account.error) return account.error;
  const payload = await request.json() as { learnerEmail?: string; verifierEmail?: string };
  const learnerEmail = payload.learnerEmail?.trim().toLowerCase() ?? "";
  const verifierEmail = payload.verifierEmail?.trim().toLowerCase() ?? "";
  if (!learnerEmail || !verifierEmail) return Response.json({ error: "Choose a verification case and reviewer." }, { status: 400 });
  const verifier = await getRawDb().prepare("SELECT email FROM users WHERE email = ? AND status = 'active' AND role IN ('admin', 'facilitator') LIMIT 1").bind(verifierEmail).first();
  if (!verifier) return Response.json({ error: "The selected reviewer is not an active administrator or facilitator." }, { status: 400 });
  const result = await getRawDb().prepare("UPDATE users SET verifier_email = ? WHERE email = ? AND identity_status = 'pending_review'").bind(verifierEmail, learnerEmail).run();
  if (!result.meta.changes) return Response.json({ error: "This identity case is no longer pending." }, { status: 409 });
  return Response.json({ assigned: true, learnerEmail, verifierEmail });
}
