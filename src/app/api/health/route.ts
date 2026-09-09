import { getRawDb } from "@/db/raw";

export const dynamic = "force-dynamic";

export async function GET() {
  const secret = process.env.AUTH_SECRET ?? "";
  const adminEmail = process.env.INITIAL_ADMIN_EMAIL?.trim() ?? "";
  const dataDirectory = process.env.DATA_DIR?.trim() ?? "";
  const sqlitePath = process.env.SQLITE_PATH?.trim() ?? "";
  const checks = {
    authSecret: secret.length >= 32,
    initialAdministrator: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail),
    persistentDataDirectory: Boolean(dataDirectory),
    persistentDatabasePath: Boolean(sqlitePath) && (!dataDirectory || sqlitePath.startsWith(dataDirectory)),
    database: false,
    paymentGateway: true,
  };

  try {
    const result = await getRawDb().prepare("SELECT 1 AS ready").first<{ ready: number }>();
    checks.database = result?.ready === 1;
    const paidCourses = await getRawDb().prepare("SELECT design_json FROM course_drafts WHERE status = 'active'").all<{ design_json: string }>();
    const paidFeatureActive = paidCourses.results.some((course) => {
      try {
        const design = JSON.parse(course.design_json || "{}") as { priceGhs?: number; certificateFeeGhs?: number };
        return Number(design.priceGhs) > 0 || Number(design.certificateFeeGhs) > 0;
      } catch { return false; }
    });
    checks.paymentGateway = !paidFeatureActive || Boolean(process.env.PAYSTACK_SECRET_KEY?.trim());
  } catch {
    checks.database = false;
  }

  const ready = Object.values(checks).every(Boolean);
  return Response.json(
    { status: ready ? "ready" : "configuration_required", checks },
    { status: ready ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
