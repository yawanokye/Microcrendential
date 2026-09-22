import { getRawDb } from "@/db/raw";
import { createAuthChallenge, verifyAuthChallenge, type ChallengePortal } from "@/lib/auth-challenges";
import { emailDeliveryUserMessage, sendSecurityCode, transactionalEmailConfigured } from "@/lib/email";
import { createPasswordRecord, validatePassword } from "@/lib/passwords";
import { rejectCrossSiteMutation } from "@/lib/request-security";
import { clearLoginFailures, loginThrottle, recordLoginFailure } from "@/lib/auth-rate-limit";
import { getPlatformMode } from "@/lib/platform-mode";

type AccountRow = { email: string };
type UserRow = { role: ChallengePortal };

export async function POST(request: Request) {
  const origin = rejectCrossSiteMutation(request);
  if (origin) return origin;
  const payload = await request.json() as { action?: "request" | "confirm"; email?: string; challengeId?: string; code?: string; password?: string };
  const db = getRawDb();

  if (payload.action === "request") {
    const email = payload.email?.trim().toLowerCase() ?? "";
    if (!/^\S+@\S+\.\S+$/.test(email)) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
    const throttle = await loginThrottle(request, "password-reset", email);
    if (throttle.blocked) return Response.json({ error: "Too many recovery requests. Try again later." }, { status: 429, headers: { "retry-after": String(throttle.retryAfterSeconds) } });
    await recordLoginFailure(throttle.key);
    if (await getPlatformMode() === "demonstration") return Response.json({ error: "Email password recovery is unavailable while the platform is in Demonstration mode. Sign in with your existing password or contact the platform administrator." }, { status: 409 });
    if (!transactionalEmailConfigured()) return Response.json({ error: "Password recovery email is not configured. Contact UCC Growth+ support." }, { status: 503 });
    const account = await db.prepare("SELECT email FROM auth_accounts WHERE email = ? LIMIT 1").bind(email).first<AccountRow>();
    const user = await db.prepare("SELECT role FROM users WHERE email = ? LIMIT 1").bind(email).first<UserRow>();
    const initialAdmin = (process.env.INITIAL_ADMIN_EMAIL || "").trim().toLowerCase();
    const portal: ChallengePortal = user?.role ?? (email === initialAdmin ? "admin" : "learner");
    const challenge = await createAuthChallenge(email, portal, "password_reset");
    if (account) {
      try {
        await sendSecurityCode(email, challenge.code, "password_reset");
      } catch (error) {
        await db.prepare("UPDATE auth_challenges SET used_at = CURRENT_TIMESTAMP WHERE id = ?").bind(challenge.id).run();
        console.error("Password recovery email failed", error);
        return Response.json({ error: emailDeliveryUserMessage(error) }, { status: 503 });
      }
    }
    return Response.json({ challengeId: challenge.id, message: "If an account matches that email, a six-digit reset code has been sent." });
  }

  if (payload.action === "confirm") {
    const passwordError = validatePassword(payload.password ?? "");
    if (passwordError) return Response.json({ error: passwordError }, { status: 400 });
    const verified = await verifyAuthChallenge(payload.challengeId?.trim() ?? "", payload.code?.trim() ?? "");
    if ("error" in verified || verified.challenge.purpose !== "password_reset") return Response.json({ error: "This reset code is invalid or has expired." }, { status: 401 });
    const account = await db.prepare("SELECT email FROM auth_accounts WHERE email = ? LIMIT 1").bind(verified.challenge.email).first<AccountRow>();
    if (!account) return Response.json({ error: "This reset code is invalid or has expired." }, { status: 401 });
    const passwordRecord = createPasswordRecord(payload.password!);
    await db.prepare("UPDATE auth_accounts SET password_hash = ?, password_salt = ?, password_changed_at = CURRENT_TIMESTAMP, session_version = session_version + 1 WHERE email = ?")
      .bind(passwordRecord.passwordHash, passwordRecord.salt, account.email).run();
    await db.prepare("UPDATE auth_challenges SET used_at = CURRENT_TIMESTAMP WHERE email = ? AND used_at IS NULL").bind(account.email).run();
    const throttle = await loginThrottle(request, "password-reset", account.email);
    await clearLoginFailures(throttle.key);
    await db.prepare("INSERT INTO admin_audit_log (admin_email,action,details_json) VALUES (?,'account.password_reset','{}')").bind(account.email).run();
    return Response.json({ reset: true });
  }

  return Response.json({ error: "Choose a password-recovery action." }, { status: 400 });
}
