import { getIdentityAndProfile } from "@/lib/accounts";
import { getRawDb } from "@/db/raw";

const hashToken = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map((byte) => byte.toString(16).padStart(2, "0")).join("");

export async function POST(request: Request) {
  const { identity, profile } = await getIdentityAndProfile();
  if (!identity) return Response.json({ error: "Sign in using the invited email address." }, { status: 401 });
  if (!profile || profile.role !== "facilitator" || profile.status !== "pending_setup") return Response.json({ error: "This account does not have a pending facilitator invitation." }, { status: 403 });
  const payload = await request.json() as { token?: string; fullName?: string; dateOfBirth?: string; gender?: string; nationality?: string; phone?: string; address?: string; idType?: string; idLast4?: string; idDocumentKey?: string; selfieKey?: string; consent?: boolean };
  const invite = await getRawDb().prepare("SELECT invite_token_hash, invite_expires_at FROM users WHERE email = ? LIMIT 1").bind(profile.email).first<{ invite_token_hash: string | null; invite_expires_at: string | null }>();
  if (!payload.token || !invite?.invite_token_hash || await hashToken(payload.token) !== invite.invite_token_hash) return Response.json({ error: "The facilitator setup link is invalid." }, { status: 403 });
  if (!invite.invite_expires_at || Date.parse(invite.invite_expires_at) < Date.now()) return Response.json({ error: "The facilitator setup link has expired. Ask the administrator for a new invitation." }, { status: 410 });
  const required = [payload.fullName, payload.dateOfBirth, payload.gender, payload.nationality, payload.phone, payload.address, payload.idType, payload.idLast4, payload.idDocumentKey, payload.selfieKey];
  if (required.some((value) => !value?.trim()) || !payload.consent) return Response.json({ error: "Complete all biodata, identity evidence and consent fields." }, { status: 400 });
  await getRawDb().prepare("UPDATE users SET full_name = ?, status = 'pending_verification', date_of_birth = ?, gender = ?, nationality = ?, phone = ?, address = ?, id_type = ?, id_last4 = ?, id_document_key = ?, selfie_key = ?, identity_status = 'pending_review', invite_token_hash = NULL, invite_expires_at = NULL, setup_completed_at = CURRENT_TIMESTAMP WHERE email = ?")
    .bind(payload.fullName!.trim(), payload.dateOfBirth, payload.gender, payload.nationality, payload.phone, payload.address, payload.idType, payload.idLast4!.slice(-4), payload.idDocumentKey, payload.selfieKey, profile.email).run();
  return Response.json({ profile: { email: profile.email, fullName: payload.fullName!.trim(), role: "facilitator", status: "pending_verification", identityStatus: "pending_review" } });
}
