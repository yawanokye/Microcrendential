import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type ChatGPTUser = { displayName: string; email: string; fullName: string | null };
type SessionPayload = { email: string; fullName: string; expiresAt: number };

export const SESSION_COOKIE = "ucc_render_session";
const SIGN_IN_PATH = "/signin-with-chatgpt";
const SIGN_OUT_PATH = "/signout-with-chatgpt";

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value && process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET is required.");
  return value || "local-development-secret-change-before-deploy";
}

function signature(value: string) { return createHmac("sha256", secret()).update(value).digest("base64url"); }

export function createSessionToken(email: string, fullName: string) {
  const body = Buffer.from(JSON.stringify({ email: email.toLowerCase(), fullName, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 } satisfies SessionPayload)).toString("base64url");
  return `${body}.${signature(body)}`;
}

function verifySessionToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [body, supplied] = token.split("."); if (!body || !supplied) return null;
  const expected = signature(body); const suppliedBytes = Buffer.from(supplied); const expectedBytes = Buffer.from(expected);
  if (suppliedBytes.length !== expectedBytes.length || !timingSafeEqual(suppliedBytes, expectedBytes)) return null;
  try { const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload; return payload.email && payload.fullName && payload.expiresAt > Date.now() ? payload : null; }
  catch { return null; }
}

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const payload = verifySessionToken(token);
  return payload ? { displayName: payload.fullName, email: payload.email, fullName: payload.fullName } : null;
}

export async function requireChatGPTUser(returnTo: string): Promise<ChatGPTUser> {
  const user = await getChatGPTUser(); if (user) return user; redirect(chatGPTSignInPath(returnTo));
}

export function chatGPTSignInPath(returnTo: string) { return `${SIGN_IN_PATH}?return_to=${encodeURIComponent(safeRelativeReturnPath(returnTo))}`; }
export function chatGPTSignOutPath(returnTo = "/") { return `${SIGN_OUT_PATH}?return_to=${encodeURIComponent(safeRelativeReturnPath(returnTo))}`; }
export function safeRelativeReturnPath(value: string) { if (!value.startsWith("/") || value.startsWith("//")) return "/"; try { const url = new URL(value, "https://app.local"); return url.origin === "https://app.local" ? `${url.pathname}${url.search}${url.hash}` : "/"; } catch { return "/"; } }
