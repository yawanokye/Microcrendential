import { requireActiveProfile } from "@/lib/accounts";
import { evaluatePilotReadiness } from "@/lib/pilot-readiness";

export async function GET() {
  const account = await requireActiveProfile(["admin"]);
  if (account.error) return account.error;
  return Response.json(await evaluatePilotReadiness(), { headers: { "cache-control": "no-store" } });
}
