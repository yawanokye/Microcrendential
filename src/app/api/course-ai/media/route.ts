import { z } from "zod";
import { requireActiveProfile } from "@/lib/accounts";
import { analyseMediaWithVertex } from "@/lib/ai-course-studio";
import { recordAudit } from "@/lib/audit";
import { rejectCrossSiteMutation } from "@/lib/request-security";

const requestSchema = z.object({
  sourceUrl: z.string().min(8).max(2000),
  mimeType: z.string().max(120).optional(),
  instruction: z.string().max(2000).optional(),
  outcomeIds: z.array(z.string().max(80)).max(20).optional(),
});

export async function POST(request: Request) {
  const origin = rejectCrossSiteMutation(request);
  if (origin) return origin;
  const account = await requireActiveProfile(["facilitator", "admin"]);
  if (account.error || !account.profile) return account.error;
  const raw = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "The media-analysis request is invalid.", details: parsed.error.flatten() }, { status: 400 });
  try {
    const result = await analyseMediaWithVertex(parsed.data);
    await recordAudit(account.profile.email, "course.ai_media_analysed", { model: result.model, source: parsed.data.sourceUrl.slice(0, 300), chapters: result.analysis.chapters.length });
    return Response.json({ ...result, warning: "Verify the transcript, timestamps, copyright, accessibility and assessment suggestions before publishing." });
  } catch (error) {
    await recordAudit(account.profile.email, "course.ai_media_failed", { source: parsed.data.sourceUrl.slice(0, 300), error: error instanceof Error ? error.message : "Unknown error" });
    return Response.json({ error: error instanceof Error ? error.message : "Gemini media analysis failed." }, { status: 502 });
  }
}
