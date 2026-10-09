import { platformJwks, ltiErrorResponse } from "@/lib/lti-platform";
export async function GET() { try { return Response.json(await platformJwks(), { headers: { "cache-control": "public, max-age=300" } }); } catch (e) { return ltiErrorResponse(e); } }
