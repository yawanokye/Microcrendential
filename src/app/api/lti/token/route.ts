import { issueLtiToken, ltiErrorResponse } from "@/lib/lti-platform";
export async function POST(request: Request) { try { return Response.json(await issueLtiToken(new URLSearchParams(await request.text())), { headers: { "cache-control": "no-store", pragma: "no-cache" } }); } catch (e) { return ltiErrorResponse(e); } }
