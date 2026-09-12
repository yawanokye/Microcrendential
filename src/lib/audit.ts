import { getRawDb } from "@/db/raw";

export async function recordAudit(actorEmail: string, action: string, details: Record<string, unknown> = {}) {
  await getRawDb().prepare("INSERT INTO admin_audit_log (admin_email, action, details_json) VALUES (?, ?, ?)")
    .bind(actorEmail, action.slice(0, 120), JSON.stringify(details)).run();
}
