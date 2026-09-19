import { getRawDb } from "@/db/raw";
import { requireActiveProfile } from "@/lib/accounts";

type Activity = { id?: string; kind?: "colab" | "virtual_lab"; title?: string; practicalId?: string; required?: boolean; sectionId?: string; maxMark?:number; passMark?:number };
const parseActivities = (value: string) => { try { const parsed=JSON.parse(value||"[]") as unknown; return Array.isArray(parsed)?parsed.filter((item):item is Activity=>Boolean(item&&typeof item==="object")):[]; } catch { return []; } };

export async function GET(request: Request) {
  const account = await requireActiveProfile(["learner"]); if (account.error || !account.profile) return account.error;
  const courseCode = new URL(request.url).searchParams.get("courseCode")?.trim() ?? "";
  const db = getRawDb();
  const course = await db.prepare("SELECT activities_json FROM course_drafts WHERE code=? AND status='active' LIMIT 1").bind(courseCode).first<{activities_json:string}>();
  if (!course) return Response.json({ error: "Active course not found." }, { status: 404 });
  const statuses: Record<string, { passed:boolean; status:string; mark:number|null; feedback:string; assessedAt:string|null }> = {};
  for (const [index, activity] of parseActivities(course.activities_json).entries()) {
    const id = String(activity.id || `activity-${index+1}`);
    if (activity.kind === "virtual_lab" && activity.practicalId) {
      const row = await db.prepare("SELECT status,mark,feedback,assessed_at FROM virtual_lab_submissions WHERE learner_email=? AND practical_id=? ORDER BY id DESC LIMIT 1").bind(account.profile.email,activity.practicalId).first<{status:string;mark:number|null;feedback:string;assessed_at:string|null}>();
      const maximum=Math.max(1,Number(activity.maxMark)||100),threshold=Math.min(100,Math.max(1,Number(activity.passMark)||60));
      const percentage=row?.mark===null||row?.mark===undefined?null:(Number(row.mark)/maximum)*100;
      statuses[id] = { passed:Boolean(row&&row.status==="assessed"&&percentage!==null&&percentage>=threshold&&row.feedback?.trim()), status:row?.status ?? "not_started", mark:row?.mark ?? null, feedback:row?.feedback ?? "", assessedAt:row?.assessed_at ?? null };
    } else if (activity.kind === "colab") {
      const assignment = await db.prepare("SELECT id FROM colab_assignments WHERE course_code=? AND title=? AND status='active' ORDER BY id DESC LIMIT 1").bind(courseCode,activity.title ?? "").first<{id:number}>();
      const row = assignment ? await db.prepare("SELECT status,mark,passed,feedback,assessed_at FROM colab_submissions WHERE assignment_id=? AND learner_email=? ORDER BY id DESC LIMIT 1").bind(assignment.id,account.profile.email).first<{status:string;mark:number|null;passed:number;feedback:string;assessed_at:string|null}>() : null;
      statuses[id] = { passed:Boolean(row?.passed && row?.feedback?.trim()), status:row?.status ?? "not_started", mark:row?.mark ?? null, feedback:row?.feedback ?? "", assessedAt:row?.assessed_at ?? null };
    }
  }
  return Response.json({ statuses });
}
