import { getRawDb } from "@/db/raw";

export const dynamic = "force-dynamic";

/**
 * Render deployment liveness probe.
 *
 * Only runtime failures that make the application unusable should return 503.
 * Optional or first-run configuration is reported by /api/health instead and
 * must not prevent a successfully started instance from becoming live.
 */
export async function GET() {
  try {
    const result = await getRawDb().prepare("SELECT 1 AS ready").first<{ ready: number }>();
    const healthy = result?.ready === 1;
    return Response.json(
      { status: healthy ? "ok" : "unavailable", healthy, checks: { database: healthy } },
      { status: healthy ? 200 : 503, headers: { "cache-control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "unavailable", healthy: false, checks: { database: false } },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
