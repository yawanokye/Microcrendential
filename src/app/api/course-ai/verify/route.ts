import { requireActiveProfile } from "@/lib/accounts";
import { courseAiStatus, type CourseAiProvider } from "@/lib/course-ai";
import { verificationInput } from "@/lib/course-ai-verification";
import { queueCourseAi, processCourseAiJob, ensureAiTables, recoverStaleAiJobs } from "@/lib/course-ai-jobs";
import { getRawDb } from "@/db/raw";
import { rejectCrossSiteMutation } from "@/lib/request-security";
import { recordAudit } from "@/lib/audit";
import { after } from "next/server";
export async function GET() {
  const account = await requireActiveProfile(["admin"]); if (account.error || !account.profile) return account.error;
  await recoverStaleAiJobs(); ensureAiTables(); const rows = await getRawDb().prepare("SELECT id,status,error,proposal_json,created_at FROM course_ai_jobs WHERE owner_email=? AND json_extract(input_json,'$.verification')=1 ORDER BY created_at DESC LIMIT 5").bind(account.profile.email).all<{ id: string; status: string; error: string; proposal_json: string; created_at: string }>();
  for (const row of rows.results.filter(r=>r.status==="queued")) after(()=>processCourseAiJob(row.id));
  return Response.json({ ...courseAiStatus(), results: rows.results.map(r => { const p = r.proposal_json ? JSON.parse(r.proposal_json) : null; return { id: r.id, state: r.status, createdAt: r.created_at, error: r.error, verification: p?.verification, provider: p?.provider, model: p?.model }; }) });
}
export async function POST(request: Request) {
  const origin = rejectCrossSiteMutation(request); if (origin) return origin;
  const account = await requireActiveProfile(["admin"]); if (account.error || !account.profile) return account.error;
  const body = await request.json() as { provider?: CourseAiProvider }; const provider = ["auto", "openai", "vertex"].includes(String(body.provider)) ? body.provider! : "auto";
  const status = courseAiStatus(); if (!status.available || provider !== "auto" && !status.providers.find(p => p.id === provider)?.configured) return Response.json({ error: "Configure the selected AI provider before running a live verification request." }, { status: 503 });
  try { const id = queueCourseAi(account.profile.email, verificationInput(provider)); after(() => processCourseAiJob(id)); await recordAudit(account.profile.email, "course.ai_live_verification", { id, provider }); return Response.json({ job: { id, status: "queued" } }, { status: 202 }); }
  catch (e) { return Response.json({ error: e instanceof Error ? e.message : "Live verification could not start." }, { status: 429 }); }
}
