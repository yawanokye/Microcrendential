import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getRawDb } from "@/db/raw";

export type AccountProfile = { email: string; full_name: string; role: "learner" | "facilitator" | "admin"; status: "active" | "pending_setup" | "pending_verification" | "rejected" | "suspended"; identity_status: "not_submitted" | "pending_review" | "verified" | "rejected"; date_of_birth: string | null; gender: string | null; nationality: string | null; phone: string | null; address: string | null; id_type: string | null; id_last4: string | null; student_number: string | null; education_level: string | null; occupation: string | null; organisation: string | null; interests_json: string; preferred_language: string; accessibility_needs: string | null };
const INITIAL_ADMIN_EMAIL = (process.env.INITIAL_ADMIN_EMAIL || "anokyeadam1@gmail.com").toLowerCase();

export async function getIdentityAndProfile() {
  const identity = await getChatGPTUser();
  if (!identity) return { identity: null, profile: null };
  const db = getRawDb();
  if (identity.email.toLowerCase() === INITIAL_ADMIN_EMAIL) {
    await db.prepare("INSERT OR IGNORE INTO users (email, full_name, role, status, created_by_email) VALUES (?, ?, 'admin', 'active', ?)")
      .bind(identity.email.toLowerCase(), identity.fullName ?? identity.displayName, identity.email.toLowerCase()).run();
  }
  const profile = await db.prepare("SELECT email, full_name, role, status, identity_status, date_of_birth, gender, nationality, phone, address, id_type, id_last4, student_number, education_level, occupation, organisation, interests_json, preferred_language, accessibility_needs FROM users WHERE email = ? LIMIT 1")
    .bind(identity.email.toLowerCase()).first<AccountProfile>();
  return { identity, profile: profile ?? null };
}

export async function requireActiveProfile(roles?: AccountProfile["role"][]) {
  const { identity, profile } = await getIdentityAndProfile();
  if (!identity) return { error: Response.json({ error: "Sign in is required." }, { status: 401 }), identity: null, profile: null };
  if (!profile) return { error: Response.json({ error: "Complete learner registration or contact the administrator." }, { status: 403 }), identity, profile: null };
  if (profile.status !== "active") return { error: Response.json({ error: "This account is not active. Complete identity verification or contact the administrator." }, { status: 403 }), identity, profile };
  if (roles && !roles.includes(profile.role)) return { error: Response.json({ error: "You do not have permission for this action." }, { status: 403 }), identity, profile };
  return { error: null, identity, profile };
}
