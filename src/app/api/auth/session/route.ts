import { getIdentityAndProfile } from "@/lib/accounts";
import { getRawDb } from "@/db/raw";
import { ownsValidIdentityEvidence } from "@/lib/identity-evidence";

export async function GET() {
  const { identity, profile } = await getIdentityAndProfile();
  if (!identity) return Response.json({ authenticated: false });
  let enrollments: string[] = [];
  if (profile?.role === "learner") {
    const rows = await getRawDb().prepare("SELECT course_code FROM enrollments WHERE user_email = ? AND status = 'active' ORDER BY enrolled_at DESC")
      .bind(profile.email).all<{ course_code: string }>();
    enrollments = rows.results.map((row) => row.course_code);
  }
  let interests: string[] = [];
  try { interests = profile ? JSON.parse(profile.interests_json || "[]") as string[] : []; } catch { interests = []; }
  return Response.json({ authenticated: true, identity: { email: identity.email, fullName: identity.fullName ?? identity.displayName }, profile: profile ? { email: profile.email, fullName: profile.full_name, role: profile.role, status: profile.status, identityStatus: profile.identity_status, dateOfBirth: profile.date_of_birth ?? "", gender: profile.gender ?? "", nationality: profile.nationality ?? "", phone: profile.phone ?? "", address: profile.address ?? "", idType: profile.id_type ?? "", idLast4: profile.id_last4 ?? "", studentNumber: profile.student_number ?? "", educationLevel: profile.education_level ?? "", occupation: profile.occupation ?? "", organisation: profile.organisation ?? "", interests, preferredLanguage: profile.preferred_language ?? "English", accessibilityNeeds: profile.accessibility_needs ?? "" } : null, enrollments });
}

export async function POST(request: Request) {
  const { identity, profile } = await getIdentityAndProfile();
  if (!identity) return Response.json({ error: "Sign in is required." }, { status: 401 });
  if (profile) return Response.json({ error: "An account already exists for this email." }, { status: 409 });
  const payload = await request.json() as { fullName?: string; dateOfBirth?: string; gender?: string; nationality?: string; phone?: string; address?: string; idType?: string; idLast4?: string; idDocumentKey?: string; selfieKey?: string; consent?: boolean; educationLevel?: string; occupation?: string; organisation?: string; interests?: string[]; preferredLanguage?: string; accessibilityNeeds?: string; termsAccepted?: boolean; privacyAccepted?: boolean };
  const fullName = payload.fullName?.trim() || identity.fullName || identity.displayName;
  const required = [payload.dateOfBirth, payload.gender, payload.nationality, payload.phone, payload.address, payload.idType, payload.idLast4, payload.idDocumentKey, payload.selfieKey, payload.educationLevel, payload.preferredLanguage];
  if (!fullName || required.some((value) => !value?.trim()) || !payload.consent || !payload.termsAccepted || !payload.privacyAccepted) return Response.json({ error: "Complete all student profile, identity evidence, terms and privacy-consent fields." }, { status: 400 });
  if (!await ownsValidIdentityEvidence(identity.email, payload.idDocumentKey!, payload.selfieKey!)) return Response.json({ error: "Upload a valid identity document and live selfie from this signed-in account." }, { status: 400 });
  const interests = Array.isArray(payload.interests) ? payload.interests.map((item) => String(item).trim()).filter(Boolean).slice(0, 9) : [];
  const db = getRawDb();
  const created = await db.prepare("INSERT INTO users (email, full_name, role, status, date_of_birth, gender, nationality, phone, address, id_type, id_last4, id_document_key, selfie_key, identity_status, education_level, occupation, organisation, interests_json, preferred_language, accessibility_needs, terms_accepted_at, privacy_accepted_at, setup_completed_at) VALUES (?, ?, 'learner', 'pending_verification', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_review', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)")
    .bind(identity.email.toLowerCase(), fullName, payload.dateOfBirth, payload.gender, payload.nationality, payload.phone, payload.address, payload.idType, payload.idLast4!.slice(-4), payload.idDocumentKey, payload.selfieKey, payload.educationLevel, payload.occupation?.trim() || null, payload.organisation?.trim() || null, JSON.stringify(interests), payload.preferredLanguage, payload.accessibilityNeeds?.trim() || null).run();
  const studentNumber = `UCC-MC-${new Date().getUTCFullYear()}-${String(created.meta.last_row_id).padStart(6, "0")}`;
  await db.prepare("UPDATE users SET student_number = ? WHERE id = ?").bind(studentNumber, created.meta.last_row_id).run();
  return Response.json({ profile: { email: identity.email.toLowerCase(), fullName, role: "learner", status: "pending_verification", identityStatus: "pending_review", studentNumber, educationLevel: payload.educationLevel, occupation: payload.occupation ?? "", organisation: payload.organisation ?? "", interests, preferredLanguage: payload.preferredLanguage, accessibilityNeeds: payload.accessibilityNeeds ?? "" }, enrollments: [] }, { status: 201 });
}
