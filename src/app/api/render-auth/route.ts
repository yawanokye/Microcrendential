import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createSessionToken, safeRelativeReturnPath, SESSION_COOKIE } from "@/app/chatgpt-auth";
import { getRawDb } from "@/db/raw";

type AuthAccount = { email: string; full_name: string; password_hash: string; password_salt: string };
const hash = (password: string, salt: string) => scryptSync(password, salt, 64).toString("hex");

export async function POST(request: Request) {
  const payload = await request.json() as { mode?: "login" | "register" | "admin_setup"; email?: string; fullName?: string; password?: string; returnTo?: string; termsAccepted?: boolean };
  const email = payload.email?.trim().toLowerCase() ?? ""; const fullName = payload.fullName?.trim() ?? ""; const password = payload.password ?? "";
  if (!/^\S+@\S+\.\S+$/.test(email)) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  if (password.length < 10) return Response.json({ error: "Passwords must contain at least 10 characters." }, { status: 400 });
  const db = getRawDb(); const existing = await db.prepare("SELECT email, full_name, password_hash, password_salt FROM auth_accounts WHERE email = ? LIMIT 1").bind(email).first<AuthAccount>();
  let account = existing;
  if (payload.mode === "register" || payload.mode === "admin_setup") {
    if (!fullName) return Response.json({ error: "Enter your full legal name." }, { status: 400 });
    if (payload.mode === "register" && !payload.termsAccepted) return Response.json({ error: "Accept the platform terms before creating a student account." }, { status: 400 });
    if (payload.mode === "admin_setup") {
      const initialAdminEmail = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
      if (!initialAdminEmail) return Response.json({ error: "INITIAL_ADMIN_EMAIL is not configured on Render." }, { status: 503 });
      if (email !== initialAdminEmail) return Response.json({ error: "Use the administrator email configured for this platform." }, { status: 403 });
    }
    if (existing) return Response.json({ error: "An account already exists for this email. Sign in instead." }, { status: 409 });
    const salt = randomBytes(16).toString("hex"); const passwordHash = hash(password, salt);
    await db.prepare("INSERT INTO auth_accounts (email, full_name, password_hash, password_salt) VALUES (?, ?, ?, ?)").bind(email, fullName, passwordHash, salt).run();
    account = { email, full_name: fullName, password_hash: passwordHash, password_salt: salt };
  } else {
    if (!existing) return Response.json({ error: "No account was found for this email." }, { status: 401 });
    const supplied = Buffer.from(hash(password, existing.password_salt), "hex"); const stored = Buffer.from(existing.password_hash, "hex");
    if (supplied.length !== stored.length || !timingSafeEqual(supplied, stored)) return Response.json({ error: "The email or password is incorrect." }, { status: 401 });
  }
  if (!account) return Response.json({ error: "Authentication could not be completed." }, { status: 500 });
  const response = NextResponse.json({ authenticated: true, returnTo: safeRelativeReturnPath(payload.returnTo ?? "/") });
  response.cookies.set(SESSION_COOKIE, createSessionToken(account.email, account.full_name), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 7 * 24 * 60 * 60 });
  return response;
}
