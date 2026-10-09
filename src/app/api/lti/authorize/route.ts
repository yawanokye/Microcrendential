import { requireActiveProfile } from "@/lib/accounts";
import { authorizeLti, ltiFormResponse, ltiErrorResponse } from "@/lib/lti-platform";
async function authorize(request: Request) {
  const account = await requireActiveProfile(); if (account.error || !account.profile) return account.error;
  try { const params = request.method === "POST" ? new URLSearchParams(await request.text()) : new URL(request.url).searchParams; const result = await authorizeLti(account.profile, params); return ltiFormResponse(result.redirect, { id_token: result.idToken, state: result.state }); } catch (e) { return ltiErrorResponse(e); }
}
export const GET = authorize;
export const POST = authorize;
