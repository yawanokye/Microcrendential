import { getRawDb } from "@/db/raw";
import { requireActiveProfile } from "@/lib/accounts";

export async function GET() {
  const account = await requireActiveProfile();
  if (account.error || !account.profile) return account.error;
  const profile = await getRawDb().prepare("SELECT email, full_name, role, status, date_of_birth, gender, nationality, phone, address, id_type, id_last4, identity_status, student_number, education_level, occupation, organisation, interests_json, preferred_language, accessibility_needs, reviewed_at FROM users WHERE email = ? LIMIT 1").bind(account.profile.email).first();
  return Response.json({ profile });
}

export async function PATCH(request: Request) {
  const account = await requireActiveProfile();
  if (account.error || !account.profile) return account.error;
  const payload = await request.json() as { fullName?: string; dateOfBirth?: string; gender?: string; nationality?: string; phone?: string; address?: string; idType?: string; idLast4?: string; idDocumentKey?: string; selfieKey?: string; educationLevel?: string; occupation?: string; organisation?: string; interests?: string[]; preferredLanguage?: string; accessibilityNeeds?: string };
  const required = [payload.fullName, payload.dateOfBirth, payload.gender, payload.nationality, payload.phone, payload.address];
  if (required.some((value) => !value?.trim())) return Response.json({ error: "Complete all required biographical fields." }, { status: 400 });
  const replacingIdentity = Boolean(payload.idDocumentKey || payload.selfieKey);
  if (replacingIdentity && (!payload.idDocumentKey || !payload.selfieKey || !payload.idType || !payload.idLast4)) return Response.json({ error: "Upload both a national ID and a live selfie before submitting identity evidence." }, { status: 400 });
  const db = getRawDb();
  if (replacingIdentity) {
    await db.prepare("UPDATE users SET full_name = ?, date_of_birth = ?, gender = ?, nationality = ?, phone = ?, address = ?, education_level = ?, occupation = ?, organisation = ?, interests_json = ?, preferred_language = ?, accessibility_needs = ?, id_type = ?, id_last4 = ?, id_document_key = ?, selfie_key = ?, identity_status = 'pending_review', verifier_email = NULL, verification_note = NULL, reviewed_by_email = NULL, reviewed_at = NULL WHERE email = ?")
      .bind(payload.fullName!.trim(), payload.dateOfBirth, payload.gender, payload.nationality, payload.phone, payload.address, payload.educationLevel?.trim() || null, payload.occupation?.trim() || null, payload.organisation?.trim() || null, JSON.stringify(payload.interests ?? []), payload.preferredLanguage?.trim() || "English", payload.accessibilityNeeds?.trim() || null, payload.idType, payload.idLast4!.slice(-4), payload.idDocumentKey, payload.selfieKey, account.profile.email).run();
  } else {
    await db.prepare("UPDATE users SET full_name = ?, date_of_birth = ?, gender = ?, nationality = ?, phone = ?, address = ?, education_level = ?, occupation = ?, organisation = ?, interests_json = ?, preferred_language = ?, accessibility_needs = ? WHERE email = ?")
      .bind(payload.fullName!.trim(), payload.dateOfBirth, payload.gender, payload.nationality, payload.phone, payload.address, payload.educationLevel?.trim() || null, payload.occupation?.trim() || null, payload.organisation?.trim() || null, JSON.stringify(payload.interests ?? []), payload.preferredLanguage?.trim() || "English", payload.accessibilityNeeds?.trim() || null, account.profile.email).run();
  }
  const profile = await db.prepare("SELECT email, full_name, role, status, date_of_birth, gender, nationality, phone, address, id_type, id_last4, identity_status, student_number, education_level, occupation, organisation, interests_json, preferred_language, accessibility_needs FROM users WHERE email = ? LIMIT 1").bind(account.profile.email).first();
  return Response.json({ profile });
}
