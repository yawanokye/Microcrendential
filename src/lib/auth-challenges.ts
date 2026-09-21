import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { getRawDb } from "@/db/raw";

export type ChallengePurpose = "email_verification" | "staff_mfa" | "password_reset";
export type ChallengePortal = "learner" | "facilitator" | "admin";
type ChallengeRow = { id: string; email: string; portal: ChallengePortal; purpose: ChallengePurpose; code_hash: string; attempts: number; expires_at: string; used_at: string | null };

const challengeSecret = () => process.env.AUTH_SECRET || "local-development-secret-change-before-deploy";
const hashCode = (id: string, code: string) => createHmac("sha256", challengeSecret()).update(`${id}:${code}`).digest("hex");

export async function createAuthChallenge(email: string, portal: ChallengePortal, purpose: ChallengePurpose) {
  const db = getRawDb();
  const id = crypto.randomUUID();
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
  await db.prepare("UPDATE auth_challenges SET used_at = CURRENT_TIMESTAMP WHERE email = ? AND purpose = ? AND used_at IS NULL")
    .bind(email, purpose).run();
  await db.prepare("DELETE FROM auth_challenges WHERE expires_at < datetime('now','-1 day') OR used_at < datetime('now','-1 day')").run();
  await db.prepare("INSERT INTO auth_challenges (id,email,portal,purpose,code_hash,expires_at) VALUES (?,?,?,?,?,?)")
    .bind(id, email, portal, purpose, hashCode(id, code), expiresAt).run();
  return { id, code, expiresAt };
}

export async function verifyAuthChallenge(id: string, code: string) {
  const db = getRawDb();
  const row = await db.prepare("SELECT id,email,portal,purpose,code_hash,attempts,expires_at,used_at FROM auth_challenges WHERE id = ? LIMIT 1")
    .bind(id).first<ChallengeRow>();
  if (!row || row.used_at || Date.parse(row.expires_at) < Date.now() || row.attempts >= 5) return { error: "This security code is invalid or has expired." } as const;
  const supplied = Buffer.from(hashCode(id, code));
  const stored = Buffer.from(row.code_hash);
  const matches = supplied.length === stored.length && timingSafeEqual(supplied, stored);
  if (!matches) {
    await db.prepare("UPDATE auth_challenges SET attempts = attempts + 1 WHERE id = ?").bind(id).run();
    return { error: "This security code is invalid or has expired." } as const;
  }
  await db.prepare("UPDATE auth_challenges SET used_at = CURRENT_TIMESTAMP WHERE id = ?").bind(id).run();
  return { challenge: row } as const;
}
