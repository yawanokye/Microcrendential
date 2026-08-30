import { getRawDb } from "@/db/raw";
import { requireActiveProfile } from "@/lib/accounts";

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code")?.trim().toUpperCase();
  if (code) {
    const certificate = await getRawDb().prepare("SELECT certificate_code, learner_name, course_code, course_title, issued_at FROM certificates WHERE certificate_code = ? LIMIT 1").bind(code).first();
    if (!certificate) return Response.json({ valid: false, error: "Certificate was not found." }, { status: 404 });
    return Response.json({ valid: true, certificate });
  }
  const account = await requireActiveProfile(["learner"]);
  if (account.error || !account.profile) return account.error;
  const certificates = await getRawDb().prepare("SELECT certificate_code, learner_name, course_code, course_title, issued_at FROM certificates WHERE user_email = ? ORDER BY issued_at DESC").bind(account.profile.email).all();
  return Response.json({ certificates: certificates.results });
}
