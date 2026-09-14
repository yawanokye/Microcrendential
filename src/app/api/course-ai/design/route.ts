import { z } from "zod";
import { requireActiveProfile } from "@/lib/accounts";
import { generateCourseDesignSuggestion } from "@/lib/ai-course-studio";
import { recordAudit } from "@/lib/audit";
import { rejectCrossSiteMutation } from "@/lib/request-security";

const requestSchema = z.object({
  title: z.string().max(180).default(""),
  discipline: z.string().max(120).default("Interdisciplinary"),
  description: z.string().max(1200).default(""),
  design: z.record(z.string(), z.unknown()).optional(),
  questionCount: z.number().int().min(0).max(500).default(0),
  instruction: z.string().max(2000).default(""),
  workload: z.enum(["fast", "balanced", "quality"]).default("quality"),
});

export async function POST(request: Request) {
  const origin = rejectCrossSiteMutation(request);
  if (origin) return origin;
  const account = await requireActiveProfile(["facilitator", "admin"]);
  if (account.error || !account.profile) return account.error;
  const raw = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "The AI course-design request is invalid.", details: parsed.error.flatten() }, { status: 400 });
  try {
    const result = await generateCourseDesignSuggestion(parsed.data);
    await recordAudit(account.profile.email, "course.ai_design_generated", { model: result.model, workload: result.workload, title: parsed.data.title, suggestionTitle: result.suggestion.title });
    return Response.json({ ...result, warning: "AI output is an editable suggestion. A facilitator must verify it and UCC approval is still required." });
  } catch (error) {
    await recordAudit(account.profile.email, "course.ai_design_failed", { title: parsed.data.title, error: error instanceof Error ? error.message : "Unknown error" });
    return Response.json({ error: error instanceof Error ? error.message : "The AI course-design request failed." }, { status: 502 });
  }
}
