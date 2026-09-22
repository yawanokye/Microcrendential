import { getRawDb } from "@/db/raw";
import { transactionalEmailConfigured } from "@/lib/email";
import { isTrue, paymentsEnabled, staffMfaRequired } from "@/lib/runtime-config";

type CountRow = { total: number };

export type PilotReadiness = Awaited<ReturnType<typeof evaluatePilotReadiness>>;

export async function evaluatePilotReadiness() {
  const db = getRawDb();
  const [activeCourses, provostSignatures, facilitatorSignatures, openSupport, learners, lastBackup] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS total FROM course_drafts WHERE status = 'active' AND code NOT LIKE 'DEMO%'").first<CountRow>(),
    db.prepare("SELECT COUNT(*) AS total FROM certificate_signatures WHERE role = 'provost'").first<CountRow>(),
    db.prepare("SELECT COUNT(*) AS total FROM certificate_signatures WHERE role = 'facilitator'").first<CountRow>(),
    db.prepare("SELECT COUNT(*) AS total FROM support_requests WHERE status IN ('open','in_progress')").first<CountRow>(),
    db.prepare("SELECT COUNT(*) AS total FROM users WHERE role = 'learner'").first<CountRow>(),
    db.prepare("SELECT backup_file,checksum,size_bytes,created_at FROM backup_runs WHERE status = 'completed' ORDER BY id DESC LIMIT 1").first<{ backup_file: string; checksum: string; size_bytes: number; created_at: string }>(),
  ]);
  const recentBackup = Boolean(lastBackup?.created_at && Date.now() - Date.parse(lastBackup.created_at) < 36 * 60 * 60 * 1000);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "";
  let officialDomain = false;
  try { const host = new URL(appUrl); officialDomain = host.protocol === "https:" && (host.hostname === "ucc.edu.gh" || host.hostname.endsWith(".ucc.edu.gh")); } catch { officialDomain = false; }
  const checks = {
    officialDomain,
    transactionalEmail: transactionalEmailConfigured(),
    staffMfa: staffMfaRequired(),
    automaticBackup: isTrue(process.env.AUTO_BACKUP_ENABLED) && recentBackup,
    approvedPilotCourse: Number(activeCourses?.total ?? 0) > 0,
    provostSignature: Number(provostSignatures?.total ?? 0) > 0,
    facilitatorSignature: Number(facilitatorSignatures?.total ?? 0) > 0,
    supportContact: /^\S+@\S+\.\S+$/.test(process.env.SUPPORT_EMAIL?.trim() ?? ""),
    paymentModeSafe: !paymentsEnabled() || Boolean(process.env.PAYSTACK_SECRET_KEY?.trim()),
  };
  return {
    status: Object.values(checks).every(Boolean) ? "pilot_ready" as const : "action_required" as const,
    checks,
    metrics: { activeCourses: Number(activeCourses?.total ?? 0), learners: Number(learners?.total ?? 0), openSupportRequests: Number(openSupport?.total ?? 0) },
    lastBackup: lastBackup ? { createdAt: lastBackup.created_at, sizeBytes: lastBackup.size_bytes, checksum: lastBackup.checksum } : null,
  };
}
