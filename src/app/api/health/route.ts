import { getRawDb } from "@/db/raw";
import { transactionalEmailConfigured } from "@/lib/email";
import { isTrue, paymentsEnabled, staffMfaRequired } from "@/lib/runtime-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const secret = process.env.AUTH_SECRET ?? "";
  const adminEmail = process.env.INITIAL_ADMIN_EMAIL?.trim() ?? "";
  const dataDirectory = process.env.DATA_DIR?.trim() ?? "";
  const sqlitePath = process.env.SQLITE_PATH?.trim() ?? "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "";
  const supportEmail = process.env.SUPPORT_EMAIL?.trim() ?? "";
  const backupDirectory = process.env.BACKUP_DIR?.trim() ?? "";
  const retentionDays = Number(process.env.IDENTITY_RETENTION_DAYS || 90);
  const requiresOfficialDomain = isTrue(process.env.PILOT_REQUIRE_OFFICIAL_DOMAIN);
  let officialUrl = false;
  try {
    const parsed = new URL(appUrl);
    officialUrl = parsed.protocol === "https:" && (!requiresOfficialDomain || parsed.hostname === "ucc.edu.gh" || parsed.hostname.endsWith(".ucc.edu.gh"));
  } catch { officialUrl = false; }
  const checks = {
    authSecret: secret.length >= 32,
    initialAdministrator: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail),
    persistentDataDirectory: Boolean(dataDirectory),
    persistentDatabasePath: Boolean(sqlitePath) && (!dataDirectory || sqlitePath.startsWith(dataDirectory)),
    officialUrl,
    supportEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail),
    monitoring: /^https:\/\//.test(process.env.MONITORING_WEBHOOK_URL?.trim() ?? ""),
    transactionalEmail: transactionalEmailConfigured(),
    staffMfa: staffMfaRequired(),
    automatedBackup: isTrue(process.env.AUTO_BACKUP_ENABLED) && Boolean(backupDirectory) && (!dataDirectory || backupDirectory.startsWith(dataDirectory)),
    recentBackup: false,
    identityRetention: Number.isInteger(retentionDays) && retentionDays >= 1 && retentionDays <= 365,
    database: false,
    paymentGateway: true,
  };

  try {
    const result = await getRawDb().prepare("SELECT 1 AS ready").first<{ ready: number }>();
    checks.database = result?.ready === 1;
    const lastBackup = await getRawDb().prepare("SELECT created_at FROM backup_runs WHERE status = 'completed' ORDER BY id DESC LIMIT 1").first<{ created_at: string }>();
    checks.recentBackup = Boolean(lastBackup?.created_at && Date.now() - Date.parse(lastBackup.created_at) < 36 * 60 * 60 * 1000);
    const paidCourses = await getRawDb().prepare("SELECT design_json FROM course_drafts WHERE status = 'active'").all<{ design_json: string }>();
    const paidFeatureActive = paidCourses.results.some((course) => {
      try {
        const design = JSON.parse(course.design_json || "{}") as { priceGhs?: number; certificateFeeGhs?: number };
        return Number(design.priceGhs) > 0 || Number(design.certificateFeeGhs) > 0;
      } catch { return false; }
    });
    checks.paymentGateway = !paymentsEnabled() || (!paidFeatureActive || Boolean(process.env.PAYSTACK_SECRET_KEY?.trim()));
  } catch {
    checks.database = false;
  }

  const ready = Object.values(checks).every(Boolean);
  return Response.json(
    { status: ready ? "ready" : "configuration_required", checks },
    { status: ready ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
