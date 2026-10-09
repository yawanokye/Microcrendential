import { ltiErrorResponse, recordLtiScore, requireLtiService } from "@/lib/lti-platform";
import { ltiScopes } from "@/lib/lti-types";
import { issueCertificateIfComplete } from "@/lib/course-completion";
import { recordEngagement } from "@/lib/course-access";
export async function POST(request: Request, { params }: { params: Promise<{ courseCode: string; activityId: string }> }) { try { const tool = await requireLtiService(request, ltiScopes.score), { courseCode, activityId } = await params; const result = await recordLtiScore(tool, courseCode, activityId, await request.json()); if (!result.ignored) { await recordEngagement(result.email, courseCode, "evidence"); if (result.passed) await issueCertificateIfComplete(result.email, courseCode); } return new Response(null, { status: 204, headers: { "cache-control": "no-store" } }); } catch (e) { return ltiErrorResponse(e); } }
