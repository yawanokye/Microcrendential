import { getIdentityAndProfile } from "@/lib/accounts";
import { getRawDb } from "@/db/raw";

export async function GET() {
  const { identity, profile } = await getIdentityAndProfile();
  if (!identity) return Response.json({ authenticated: false });
  let enrollments: string[] = [];
  if (profile?.role === "learner") {
    const rows = await getRawDb().prepare("SELECT course_code FROM enrollments WHERE user_email = ? AND status = 'active' ORDER BY enrolled_at DESC")
      .bind(profile.email).all<{ course_code: string }>();
    enrollments = rows.results.map((row) => row.course_code);
  }
  return Response.json({ authenticated: true, identity: { email: identity.email, fullName: identity.fullName ?? identity.displayName }, profile: profile ? { email: profile.email, fullName: profile.full_name, role: profile.role, status: profile.status, identityStatus: profile.identity_status, dateOfBirth: profile.date_of_birth ?? "", gender: profile.gender ?? "", nationality: profile.nationality ?? "", phone: profile.phone ?? "", address: profile.address ?? "", idType: profile.id_type ?? "", idLast4: profile.id_last4 ?? "" } : null, enrollments });
}

export async function POST(request: Request) {
  const { identity, profile } = await getIdentityAndProfile();
  if (!identity) return Response.json({ error: "Sign in is required." }, { status: 401 });
  if (profile) return Response.json({ error: "An account already exists for this email." }, { status: 409 });
  const payload = await request.json() as { fullName?: string; dateOfBirth?: string; gender?: string; nationality?: string; phone?: string; address?: string; idType?: string; idLast4?: string; idDocumentKey?: string; selfieKey?: string; consent?: boolean };
  const fullName = payload.fullName?.trim() || identity.fullName || identity.displayName;
  const required = [payload.dateOfBirth, payload.gender, payload.nationality, payload.phone, payload.address, payload.idType, payload.idLast4, payload.idDocumentKey, payload.selfieKey];
  if (!fullName || required.some((value) => !value?.trim()) || !payload.consent) return Response.json({ error: "Complete all biodata, identity evidence and consent fields." }, { status: 400 });
  await getRawDb().prepare("INSERT INTO users (email, full_name, role, status, date_of_birth, gender, nationality, phone, address, id_type, id_last4, id_document_key, selfie_key, identity_status, setup_completed_at) VALUES (?, ?, 'learner', 'pending_verification', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_review', CURRENT_TIMESTAMP)")
    .bind(identity.email.toLowerCase(), fullName, payload.dateOfBirth, payload.gender, payload.nationality, payload.phone, payload.address, payload.idType, payload.idLast4!.slice(-4), payload.idDocumentKey, payload.selfieKey).run();
  return Response.json({ profile: { email: identity.email.toLowerCase(), fullName, role: "learner", status: "pending_verification", identityStatus: "pending_review" }, enrollments: [] }, { status: 201 });
}
