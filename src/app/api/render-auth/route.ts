import { NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE } from "@/app/chatgpt-auth";
import { getRawDb } from "@/db/raw";
import { clearLoginFailures, loginThrottle, recordLoginFailure } from "@/lib/auth-rate-limit";
import { createAuthChallenge, verifyAuthChallenge, type ChallengePurpose } from "@/lib/auth-challenges";
import { sendSecurityCode } from "@/lib/email";
import { createPasswordRecord, passwordMatches, validatePassword } from "@/lib/passwords";
import { emailVerificationRequired, pilotLearnerLimit, publicRegistrationEnabled, staffMfaRequired } from "@/lib/runtime-config";
import { rejectCrossSiteMutation } from "@/lib/request-security";

type PortalRole = "learner" | "facilitator" | "admin";
type AuthMode = "login" | "register" | "admin_setup" | "facilitator_setup" | "verify_challenge";
type AuthAccount = { email: string; full_name: string; password_hash: string; password_salt: string; email_verified_at: string | null; session_version: number };
type UserAccess = { email: string; full_name: string; role: PortalRole; status: string; invite_token_hash: string | null; invite_expires_at: string | null };

const hashToken = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map((byte) => byte.toString(16).padStart(2, "0")).join("");
const maskEmail = (email: string) => {
  const [name, domain] = email.split("@");
  return `${name.slice(0, 2)}${"*".repeat(Math.max(2, name.length - 2))}@${domain}`;
};
const returnPath = (portal: PortalRole, mode?: AuthMode, inviteToken?: string) => mode === "register"
  ? "/student-registration"
  : portal === "facilitator" && inviteToken
    ? `/facilitator-studio?invite=${encodeURIComponent(inviteToken)}`
    : portal === "facilitator" ? "/facilitator-studio" : `/?portal=${portal}`;

function authenticatedResponse(account: AuthAccount, portal: PortalRole, returnTo: string) {
  const response = NextResponse.json({ authenticated: true, portal, returnTo });
  response.cookies.set(SESSION_COOKIE, createSessionToken(account.email, account.full_name, account.session_version), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
  return response;
}

async function challengeResponse(account: AuthAccount, portal: PortalRole, purpose: ChallengePurpose, returnTo: string) {
  const challenge = await createAuthChallenge(account.email, portal, purpose);
  await sendSecurityCode(account.email, challenge.code, purpose);
  return Response.json({ challengeRequired: purpose, challengeId: challenge.id, expiresAt: challenge.expiresAt, emailHint: maskEmail(account.email), portal, returnTo });
}

export async function POST(request: Request) {
  const originError = rejectCrossSiteMutation(request);
  if (originError) return originError;
  const payload = await request.json() as { mode?: AuthMode; portal?: PortalRole; email?: string; fullName?: string; password?: string; termsAccepted?: boolean; inviteToken?: string; challengeId?: string; code?: string };
  const portal = payload.portal;
  if (!portal || !["learner", "facilitator", "admin"].includes(portal)) return Response.json({ error: "Open the Learner, Facilitator or Administration sign-in portal." }, { status: 400 });

  if (payload.mode === "verify_challenge") {
    const challengeId = payload.challengeId?.trim() ?? "";
    const code = payload.code?.trim() ?? "";
    if (!challengeId || !/^\d{6}$/.test(code)) return Response.json({ error: "Enter the six-digit security code." }, { status: 400 });
    const verified = await verifyAuthChallenge(challengeId, code);
    if ("error" in verified) return Response.json({ error: verified.error }, { status: 401 });
    if (verified.challenge.portal !== portal) return Response.json({ error: "This security code belongs to another portal." }, { status: 403 });
    const expectedPurpose: ChallengePurpose = portal === "learner" ? "email_verification" : "staff_mfa";
    if (verified.challenge.purpose !== expectedPurpose) return Response.json({ error: "This security code cannot be used to sign in." }, { status: 403 });
    const account = await getRawDb().prepare("SELECT email,full_name,password_hash,password_salt,email_verified_at,session_version FROM auth_accounts WHERE email = ? LIMIT 1")
      .bind(verified.challenge.email).first<AuthAccount>();
    if (!account) return Response.json({ error: "This account is no longer available." }, { status: 404 });
    await getRawDb().prepare("UPDATE auth_accounts SET email_verified_at = COALESCE(email_verified_at,CURRENT_TIMESTAMP) WHERE email = ?").bind(account.email).run();
    const verifiedThrottle = await loginThrottle(request, portal, account.email);
    await clearLoginFailures(verifiedThrottle.key);
    const destination = payload.inviteToken ? returnPath(portal, undefined, payload.inviteToken) : returnPath(portal, portal === "learner" ? "register" : "login");
    return authenticatedResponse(account, portal, destination);
  }

  const email = payload.email?.trim().toLowerCase() ?? "";
  const fullName = payload.fullName?.trim() ?? "";
  const password = payload.password ?? "";
  if (!/^\S+@\S+\.\S+$/.test(email)) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  const passwordError = validatePassword(password);
  if (passwordError) return Response.json({ error: passwordError }, { status: 400 });

  const throttle = await loginThrottle(request, portal, email);
  if (throttle.blocked) return Response.json({ error: "Too many failed sign-in attempts. Try again later." }, { status: 429, headers: { "retry-after": String(throttle.retryAfterSeconds) } });
  const db = getRawDb();
  const existing = await db.prepare("SELECT email,full_name,password_hash,password_salt,email_verified_at,session_version FROM auth_accounts WHERE email = ? LIMIT 1").bind(email).first<AuthAccount>();
  let account = existing;
  const user = await db.prepare("SELECT email,full_name,role,status,invite_token_hash,invite_expires_at FROM users WHERE email = ? LIMIT 1").bind(email).first<UserAccess>();
  const initialAdminEmail = (process.env.INITIAL_ADMIN_EMAIL || "").trim().toLowerCase();
  let accountCreated = false;

  if (payload.mode === "register") {
    if (portal !== "learner") return Response.json({ error: "Learner registration is available only through the Learner Registration Portal." }, { status: 403 });
    if (!publicRegistrationEnabled()) return Response.json({ error: "Public learner registration is temporarily closed for this pilot." }, { status: 503 });
    if (user && user.role !== "learner") return Response.json({ error: `This email is reserved for the ${user.role === "facilitator" ? "Facilitator" : "Administration"} Portal.` }, { status: 403 });
    if (email === initialAdminEmail) return Response.json({ error: "The configured administrator email cannot be used for learner registration." }, { status: 403 });
    if (!fullName) return Response.json({ error: "Enter your full legal name." }, { status: 400 });
    if (!payload.termsAccepted) return Response.json({ error: "Accept the platform terms before creating a learner account." }, { status: 400 });
    if (existing) return Response.json({ error: "An account already exists for this email. Sign in instead." }, { status: 409 });
    const learnerCount = await db.prepare("SELECT COUNT(*) AS total FROM auth_accounts a LEFT JOIN users u ON u.email = a.email WHERE COALESCE(u.role,'learner') = 'learner'").first<{ total: number }>();
    if (Number(learnerCount?.total ?? 0) >= pilotLearnerLimit()) return Response.json({ error: "The official pilot has reached its current learner capacity. Contact UCC Growth+ support." }, { status: 409 });
    const passwordRecord = createPasswordRecord(password);
    await db.prepare("INSERT INTO auth_accounts (email,full_name,password_hash,password_salt,password_changed_at) VALUES (?,?,?,?,CURRENT_TIMESTAMP)")
      .bind(email, fullName, passwordRecord.passwordHash, passwordRecord.salt).run();
    account = { email, full_name: fullName, password_hash: passwordRecord.passwordHash, password_salt: passwordRecord.salt, email_verified_at: null, session_version: 1 };
    accountCreated = true;
  } else if (payload.mode === "admin_setup") {
    if (portal !== "admin") return Response.json({ error: "Administrator setup is available only through the Administration Portal." }, { status: 403 });
    if (!fullName) return Response.json({ error: "Enter your full legal name." }, { status: 400 });
    if (!initialAdminEmail) return Response.json({ error: "Administrator setup is not configured. Set INITIAL_ADMIN_EMAIL in the deployment environment." }, { status: 503 });
    if (email !== initialAdminEmail) return Response.json({ error: "Use the administrator email configured for this platform." }, { status: 403 });
    if (existing) return Response.json({ error: "An account already exists for this email. Use Administrator sign in instead." }, { status: 409 });
    const passwordRecord = createPasswordRecord(password);
    await db.prepare("INSERT INTO auth_accounts (email,full_name,password_hash,password_salt,password_changed_at) VALUES (?,?,?,?,CURRENT_TIMESTAMP)")
      .bind(email, fullName, passwordRecord.passwordHash, passwordRecord.salt).run();
    account = { email, full_name: fullName, password_hash: passwordRecord.passwordHash, password_salt: passwordRecord.salt, email_verified_at: null, session_version: 1 };
    accountCreated = true;
  } else if (payload.mode === "facilitator_setup") {
    if (portal !== "facilitator") return Response.json({ error: "Facilitator setup is available only through the Facilitator Portal." }, { status: 403 });
    if (!user || user.role !== "facilitator" || user.status !== "pending_setup") return Response.json({ error: "This email does not have a pending facilitator invitation." }, { status: 403 });
    if (!payload.inviteToken || !user.invite_token_hash || await hashToken(payload.inviteToken) !== user.invite_token_hash) return Response.json({ error: "The facilitator invitation is invalid. Open the original link issued by the administrator." }, { status: 403 });
    if (!user.invite_expires_at || Date.parse(user.invite_expires_at) < Date.now()) return Response.json({ error: "The facilitator invitation has expired. Ask the administrator for a new invitation." }, { status: 410 });
    if (existing) {
      if (!passwordMatches(password, existing)) return Response.json({ error: "An account already exists for this invitation, but the password is incorrect." }, { status: 401 });
    } else {
      const passwordRecord = createPasswordRecord(password);
      await db.prepare("INSERT INTO auth_accounts (email,full_name,password_hash,password_salt,password_changed_at) VALUES (?,?,?,?,CURRENT_TIMESTAMP)")
        .bind(email, user.full_name, passwordRecord.passwordHash, passwordRecord.salt).run();
      account = { email, full_name: user.full_name, password_hash: passwordRecord.passwordHash, password_salt: passwordRecord.salt, email_verified_at: null, session_version: 1 };
      accountCreated = true;
    }
  } else {
    if (!existing || !passwordMatches(password, existing)) {
      await recordLoginFailure(throttle.key);
      return Response.json({ error: "The email or password is incorrect." }, { status: 401 });
    }
  }
  if (!account) return Response.json({ error: "Authentication could not be completed." }, { status: 500 });

  const allowed = portal === "learner"
    ? ((!user && email !== initialAdminEmail) || user?.role === "learner")
    : portal === "facilitator"
      ? user?.role === "facilitator"
      : user?.role === "admin" || email === initialAdminEmail;
  if (!allowed) {
    await recordLoginFailure(throttle.key);
    const actualPortal = user?.role === "learner" ? "Learner" : user?.role === "facilitator" ? "Facilitator" : user?.role === "admin" || email === initialAdminEmail ? "Administration" : "another assigned";
    const requestedPortal = portal === "learner" ? "Learner" : portal === "facilitator" ? "Facilitator" : "Administration";
    const ownership = actualPortal === "another assigned" ? "another assigned portal" : `the ${actualPortal} Portal`;
    return Response.json({ error: `This account belongs to ${ownership} and cannot sign in through the ${requestedPortal} Portal.` }, { status: 403 });
  }

  const destination = returnPath(portal, payload.mode, payload.inviteToken);
  try {
    if (portal === "learner" && emailVerificationRequired() && !account.email_verified_at) return await challengeResponse(account, portal, "email_verification", destination);
    if (portal !== "learner" && staffMfaRequired()) return await challengeResponse(account, portal, "staff_mfa", destination);
  } catch (error) {
    if (accountCreated) await db.prepare("DELETE FROM auth_accounts WHERE email = ?").bind(email).run();
    console.error("Authentication code delivery failed", error);
    return Response.json({ error: "Secure email delivery is not available. Contact the platform administrator." }, { status: 503 });
  }

  await clearLoginFailures(throttle.key);
  return authenticatedResponse(account, portal, destination);
}
