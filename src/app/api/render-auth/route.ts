import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE } from "@/app/chatgpt-auth";
import { getRawDb } from "@/db/raw";

type AuthAccount = { email: string; full_name: string; password_hash: string; password_salt: string };
type PortalRole = "learner" | "facilitator" | "admin";
type UserAccess = { email: string; full_name: string; role: PortalRole; status: string; invite_token_hash: string | null; invite_expires_at: string | null };
const hash = (password: string, salt: string) => scryptSync(password, salt, 64).toString("hex");
const hashToken = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map((byte) => byte.toString(16).padStart(2, "0")).join("");
const passwordMatches = (password: string, account: AuthAccount) => {
  const supplied = Buffer.from(hash(password, account.password_salt), "hex");
  const stored = Buffer.from(account.password_hash, "hex");
  return supplied.length === stored.length && timingSafeEqual(supplied, stored);
};

export async function POST(request: Request) {
  const payload = await request.json() as { mode?: "login" | "register" | "admin_setup" | "facilitator_setup"; portal?: PortalRole; email?: string; fullName?: string; password?: string; termsAccepted?: boolean; inviteToken?: string };
  const email = payload.email?.trim().toLowerCase() ?? ""; const fullName = payload.fullName?.trim() ?? ""; const password = payload.password ?? "";
  const portal = payload.portal;
  if (!portal || !["learner", "facilitator", "admin"].includes(portal)) return Response.json({ error: "Open the Student, Facilitator or Administration sign-in portal." }, { status: 400 });
  if (!/^\S+@\S+\.\S+$/.test(email)) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  if (password.length < 10) return Response.json({ error: "Passwords must contain at least 10 characters." }, { status: 400 });
  const db = getRawDb(); const existing = await db.prepare("SELECT email, full_name, password_hash, password_salt FROM auth_accounts WHERE email = ? LIMIT 1").bind(email).first<AuthAccount>();
  let account = existing;
  const user = await db.prepare("SELECT email, full_name, role, status, invite_token_hash, invite_expires_at FROM users WHERE email = ? LIMIT 1").bind(email).first<UserAccess>();
  const initialAdminEmail = (process.env.INITIAL_ADMIN_EMAIL || "anokyeadam1@gmail.com").trim().toLowerCase();

  if (payload.mode === "register") {
    if (portal !== "learner") return Response.json({ error: "Student registration is available only through the Student Registration Portal." }, { status: 403 });
    if (user && user.role !== "learner") return Response.json({ error: `This email is reserved for the ${user.role === "facilitator" ? "Facilitator" : "Administration"} Portal.` }, { status: 403 });
    if (email === initialAdminEmail) return Response.json({ error: "The configured administrator email cannot be used for student registration." }, { status: 403 });
    if (!fullName) return Response.json({ error: "Enter your full legal name." }, { status: 400 });
    if (!payload.termsAccepted) return Response.json({ error: "Accept the platform terms before creating a student account." }, { status: 400 });
    if (existing) return Response.json({ error: "An account already exists for this email. Sign in instead." }, { status: 409 });
    const salt = randomBytes(16).toString("hex"); const passwordHash = hash(password, salt);
    await db.prepare("INSERT INTO auth_accounts (email, full_name, password_hash, password_salt) VALUES (?, ?, ?, ?)").bind(email, fullName, passwordHash, salt).run();
    account = { email, full_name: fullName, password_hash: passwordHash, password_salt: salt };
  } else if (payload.mode === "admin_setup") {
    if (portal !== "admin") return Response.json({ error: "Administrator setup is available only through the Administration Portal." }, { status: 403 });
    if (!fullName) return Response.json({ error: "Enter your full legal name." }, { status: 400 });
    if (email !== initialAdminEmail) return Response.json({ error: "Use the administrator email configured for this platform." }, { status: 403 });
    if (existing) return Response.json({ error: "An account already exists for this email. Use Administrator sign in instead." }, { status: 409 });
    const salt = randomBytes(16).toString("hex"); const passwordHash = hash(password, salt);
    await db.prepare("INSERT INTO auth_accounts (email, full_name, password_hash, password_salt) VALUES (?, ?, ?, ?)").bind(email, fullName, passwordHash, salt).run();
    account = { email, full_name: fullName, password_hash: passwordHash, password_salt: salt };
  } else if (payload.mode === "facilitator_setup") {
    if (portal !== "facilitator") return Response.json({ error: "Facilitator setup is available only through the Facilitator Portal." }, { status: 403 });
    if (!user || user.role !== "facilitator" || user.status !== "pending_setup") return Response.json({ error: "This email does not have a pending facilitator invitation." }, { status: 403 });
    if (!payload.inviteToken || !user.invite_token_hash || await hashToken(payload.inviteToken) !== user.invite_token_hash) return Response.json({ error: "The facilitator invitation is invalid. Open the original link issued by the administrator." }, { status: 403 });
    if (!user.invite_expires_at || Date.parse(user.invite_expires_at) < Date.now()) return Response.json({ error: "The facilitator invitation has expired. Ask the administrator for a new invitation." }, { status: 410 });
    if (existing) {
      if (!passwordMatches(password, existing)) return Response.json({ error: "An account already exists for this invitation, but the password is incorrect." }, { status: 401 });
    } else {
      const salt = randomBytes(16).toString("hex"); const passwordHash = hash(password, salt);
      await db.prepare("INSERT INTO auth_accounts (email, full_name, password_hash, password_salt) VALUES (?, ?, ?, ?)").bind(email, user.full_name, passwordHash, salt).run();
      account = { email, full_name: user.full_name, password_hash: passwordHash, password_salt: salt };
    }
  } else {
    if (!existing) return Response.json({ error: "No account was found for this email." }, { status: 401 });
    if (!passwordMatches(password, existing)) return Response.json({ error: "The email or password is incorrect." }, { status: 401 });
  }
  if (!account) return Response.json({ error: "Authentication could not be completed." }, { status: 500 });

  const allowed = portal === "learner"
    ? ((!user && email !== initialAdminEmail) || user?.role === "learner")
    : portal === "facilitator"
      ? user?.role === "facilitator"
      : user?.role === "admin" || email === initialAdminEmail;
  if (!allowed) {
    const actualPortal = user?.role === "learner" ? "Student" : user?.role === "facilitator" ? "Facilitator" : user?.role === "admin" || email === initialAdminEmail ? "Administration" : "another assigned";
    const requestedPortal = portal === "learner" ? "Student" : portal === "facilitator" ? "Facilitator" : "Administration";
    const ownership = actualPortal === "another assigned" ? "another assigned portal" : `the ${actualPortal} Portal`;
    return Response.json({ error: `This account belongs to ${ownership} and cannot sign in through the ${requestedPortal} Portal.` }, { status: 403 });
  }

  const returnTo = payload.mode === "register"
    ? "/student-registration"
    : portal === "facilitator" && payload.inviteToken
      ? `/facilitator-studio?invite=${encodeURIComponent(payload.inviteToken)}`
      : portal === "facilitator" ? "/facilitator-studio" : `/?portal=${portal}`;
  const response = NextResponse.json({ authenticated: true, portal, returnTo });
  response.cookies.set(SESSION_COOKIE, createSessionToken(account.email, account.full_name), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 7 * 24 * 60 * 60 });
  return response;
}
