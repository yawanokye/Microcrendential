import { requireActiveProfile } from "@/lib/accounts";
import { initiateLtiLaunch, ltiErrorResponse } from "@/lib/lti-platform";
import { rejectCrossSiteMutation } from "@/lib/request-security";
import type { StructuredLearningActivity } from "@/lib/structured-learning-activities";
export async function POST(request: Request) {
  const origin = rejectCrossSiteMutation(request); if (origin) return origin;
  const account = await requireActiveProfile(); if (account.error || !account.profile) return account.error;
  try { const body = await request.json() as { courseCode: string; activityId?: string; previewActivity?: StructuredLearningActivity; toolId?: string; deepLink?: boolean }; return Response.json(await initiateLtiLaunch(account.profile, body), { headers: { "cache-control": "no-store" } }); } catch (e) { return ltiErrorResponse(e); }
}
