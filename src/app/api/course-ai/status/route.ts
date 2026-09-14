import { requireActiveProfile } from "@/lib/accounts";
import { getAiIntegrationStatus } from "@/lib/ai-course-studio";

export async function GET() {
  const account = await requireActiveProfile(["facilitator", "admin"]);
  if (account.error) return account.error;
  return Response.json(getAiIntegrationStatus());
}
