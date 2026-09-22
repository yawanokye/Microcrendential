import { getRawDb } from "@/db/raw";
import { requireActiveProfile } from "@/lib/accounts";
import { recordAudit } from "@/lib/audit";
import { evaluatePilotReadiness } from "@/lib/pilot-readiness";
import { demonstrationModeLocked, emergencyDemonstrationMode, getPlatformMode, getSelectedPlatformMode, normalizePlatformMode, setPlatformMode } from "@/lib/platform-mode";
import { rejectCrossSiteMutation } from "@/lib/request-security";

export const dynamic = "force-dynamic";

export async function GET() {
  const mode = await getPlatformMode();
  const selectedMode = await getSelectedPlatformMode();
  return Response.json({
    mode,
    selectedMode,
    emergencyOverride: emergencyDemonstrationMode(),
    demonstrationLock: demonstrationModeLocked(),
    label: mode === "official_pilot" ? "Official Pilot" : "Demonstration",
    officialCredentialsEnabled: mode === "official_pilot",
    emailVerificationEnforced: mode === "official_pilot",
    staffMfaEnforced: mode === "official_pilot",
  }, { headers: { "cache-control": "no-store" } });
}

export async function PATCH(request: Request) {
  const originError = rejectCrossSiteMutation(request);
  if (originError) return originError;
  const account = await requireActiveProfile(["admin"]);
  if (account.error || !account.profile) return account.error;
  const payload = await request.json() as { mode?: string };
  if (!payload.mode || !["demonstration", "official_pilot"].includes(payload.mode)) return Response.json({ error: "Choose Demonstration or Official Pilot mode." }, { status: 400 });
  const requestedMode = normalizePlatformMode(payload.mode);
  if (requestedMode === "official_pilot" && (emergencyDemonstrationMode() || demonstrationModeLocked())) return Response.json({ error: "Official Pilot activation is blocked by the deployment Demonstration lock. Remove the lock only after UCC DNS and every readiness control are complete." }, { status: 409 });
  const currentMode = await getSelectedPlatformMode();
  if (requestedMode === currentMode) return Response.json({ updated: false, mode: await getPlatformMode(), selectedMode: currentMode, emergencyOverride: emergencyDemonstrationMode(), demonstrationLock: demonstrationModeLocked() });

  let readiness: Awaited<ReturnType<typeof evaluatePilotReadiness>> | null = null;
  if (requestedMode === "official_pilot") {
    readiness = await evaluatePilotReadiness();
    if (readiness.status !== "pilot_ready") return Response.json({ error: "Official Pilot activation is blocked until every readiness check passes.", readiness }, { status: 409 });
  }

  await setPlatformMode(requestedMode, account.profile.email);
  if (requestedMode === "official_pilot") await getRawDb().prepare("UPDATE auth_accounts SET session_version = session_version + 1").run();
  await recordAudit(account.profile.email, "platform.mode_changed", { from: currentMode, to: requestedMode, readiness: readiness?.checks ?? null });
  return Response.json({ updated: true, mode: await getPlatformMode(), selectedMode: requestedMode, emergencyOverride: emergencyDemonstrationMode(), demonstrationLock: demonstrationModeLocked(), reauthenticationRequired: requestedMode === "official_pilot" });
}
