import { getRawDb } from "@/db/raw";
import { requireActiveProfile } from "@/lib/accounts";

export async function GET(request: Request) {
  const parameters = new URL(request.url).searchParams;
  const code = parameters.get("code")?.trim().toUpperCase();
  if (code) {
    const certificate = await getRawDb().prepare("SELECT certificate_code, learner_name, course_code, course_title, credential_type, status, issued_at, expires_at, revoked_at, revocation_reason FROM certificates WHERE certificate_code = ? LIMIT 1").bind(code).first<{ certificate_code: string; learner_name: string; course_code: string; course_title: string; credential_type: string; status: string; issued_at: string; expires_at: string | null; revoked_at: string | null; revocation_reason: string | null }>();
    if (!certificate) return Response.json({ valid: false, error: "Certificate was not found." }, { status: 404 });
    const expired = Boolean(certificate.expires_at && Date.parse(certificate.expires_at) < Date.now());
    return Response.json({ valid: certificate.status === "active" && !expired, status: expired ? "expired" : certificate.status, certificate });
  }
  if (parameters.get("scope") === "registry") {
    const account = await requireActiveProfile(["admin"]);
    if (account.error) return account.error;
    const credentials = await getRawDb().prepare("SELECT certificate_code, learner_name, user_email, course_code, course_title, credential_type, status, issued_at, expires_at, revoked_at, revocation_reason FROM certificates ORDER BY issued_at DESC LIMIT 250").all();
    return Response.json({ credentials: credentials.results });
  }
  const account = await requireActiveProfile(["learner"]);
  if (account.error || !account.profile) return account.error;
  const certificates = await getRawDb().prepare("SELECT certificate_code, learner_name, course_code, course_title, credential_type, status, issued_at, expires_at, revoked_at, revocation_reason FROM certificates WHERE user_email = ? ORDER BY issued_at DESC").bind(account.profile.email).all();
  return Response.json({ certificates: certificates.results });
}

export async function PATCH(request: Request) {
  const account = await requireActiveProfile(["admin"]);
  if (account.error || !account.profile) return account.error;
  const payload = await request.json() as { code?: string; action?: "revoke" | "restore"; reason?: string };
  const code = payload.code?.trim().toUpperCase() ?? "";
  if (!code || !["revoke", "restore"].includes(payload.action ?? "")) return Response.json({ error: "Choose a credential and a valid governance action." }, { status: 400 });
  if (payload.action === "revoke" && (payload.reason?.trim().length ?? 0) < 8) return Response.json({ error: "Record a clear revocation reason of at least 8 characters." }, { status: 400 });
  const result = payload.action === "revoke"
    ? await getRawDb().prepare("UPDATE certificates SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP, revocation_reason = ? WHERE certificate_code = ? AND status = 'active'").bind(payload.reason!.trim(), code).run()
    : await getRawDb().prepare("UPDATE certificates SET status = 'active', revoked_at = NULL, revocation_reason = NULL WHERE certificate_code = ? AND status = 'revoked'").bind(code).run();
  if (!result.meta.changes) return Response.json({ error: "The credential was not found or is already in that state." }, { status: 409 });
  return Response.json({ updated: true, code, status: payload.action === "revoke" ? "revoked" : "active" });
}
