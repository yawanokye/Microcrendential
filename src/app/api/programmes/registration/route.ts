import { requireActiveProfile } from "@/lib/accounts";
import { rejectCrossSiteMutation } from "@/lib/request-security";
import { synchroniseProgrammeCredential } from "@/lib/programme-credentials";
import { cleanProgrammeText, registerProgrammeCourse } from "@/lib/programmes";
import { programmePayload, programmeResponse, programmeHttpFailure } from "@/lib/programme-http";

export async function POST(request: Request) {
  const originError = rejectCrossSiteMutation(request); if (originError) return originError;
  const account = await requireActiveProfile(["learner", "admin"]); if (account.error || !account.profile) return account.error;
  try { const p = await programmePayload(request), code = cleanProgrammeText(p.courseCode, 120).toUpperCase(); await registerProgrammeCourse(account.profile, Number(p.enrolmentId), code); await synchroniseProgrammeCredential(Number(p.enrolmentId)); return programmeResponse({ registered: true, courseCode: code, learningUrl: "/learn/" + encodeURIComponent(code) }); } catch (error) { return programmeHttpFailure(error); }
}
