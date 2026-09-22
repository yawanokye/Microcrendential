import { getRawDb } from "@/db/raw";

export type PlatformMode = "demonstration" | "official_pilot";

export function normalizePlatformMode(value: unknown): PlatformMode {
  return String(value ?? "").trim().toLowerCase() === "official_pilot" ? "official_pilot" : "demonstration";
}

export function configuredPlatformMode(): PlatformMode {
  return normalizePlatformMode(process.env.PLATFORM_MODE);
}

export function emergencyDemonstrationMode() {
  return process.env.EMERGENCY_DEMONSTRATION_MODE?.trim().toLowerCase() === "true";
}

export async function getSelectedPlatformMode(): Promise<PlatformMode> {
  const row = await getRawDb().prepare("SELECT setting_value FROM platform_settings WHERE setting_key = 'platform_mode' LIMIT 1")
    .first<{ setting_value: string }>();
  return row ? normalizePlatformMode(row.setting_value) : configuredPlatformMode();
}

export async function getPlatformMode(): Promise<PlatformMode> {
  if (emergencyDemonstrationMode()) return "demonstration";
  return getSelectedPlatformMode();
}

export async function setPlatformMode(mode: PlatformMode, administratorEmail: string) {
  await getRawDb().prepare(`INSERT INTO platform_settings (setting_key,setting_value,updated_by_email,updated_at)
    VALUES ('platform_mode',?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_by_email=excluded.updated_by_email,updated_at=CURRENT_TIMESTAMP`)
    .bind(mode, administratorEmail).run();
}

export const officialCredentialsEnabled = async () => (await getPlatformMode()) === "official_pilot";
