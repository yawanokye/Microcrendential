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
  };

  try {
    const result = await getRawDb().prepare("SELECT 1 AS ready").first<{ ready: number }>();
    checks.database = result?.ready === 1;
  } catch {
    checks.database = false;
  }

  const ready = Object.values(checks).every(Boolean);
  return Response.json(
    { status: ready ? "ready" : "configuration_required", checks },
    { status: ready ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
