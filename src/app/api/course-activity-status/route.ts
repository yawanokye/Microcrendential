import { getRawDb } from "@/db/raw";
import { requireActiveProfile } from "@/lib/accounts";

type Activity = {
  id?: string;
  kind?: "colab" | "virtual_lab" | "inline";
  title?: string;
  practicalId?: string;
  required?: boolean;
  sectionId?: string;
  materialId?: string;
  maxMark?: number;
  passMark?: number;
};
const parseActivities = (value: string) => { try { const parsed=JSON.parse(value||"[]") as unknown; return Array.isArray(parsed)?parsed.filter((item):item is Activity=>Boolean(item&&typeof item==="object")):[]; } catch { return []; } };

type ActivityStatus = { passed:boolean; status:string; mark:number|null; feedback:string; assessedAt:string|null; attemptNumber?:number|null; maximum?:number; passMark?:number; criteria?:unknown[]; model?:string|null };

export async function GET(request: Request) {
  const account = await requireActiveProfile(["learner"]); if (account.error || !account.profile) return account.error;
  const courseCode = new URL(request.url).searchParams.get("courseCode")?.trim() ?? "";
  const db = getRawDb();
  const course = await db.prepare("SELECT activities_json FROM course_drafts WHERE code=? AND status='active' LIMIT 1").bind(courseCode).first<{activities_json:string}>();
  if (!course) return Response.json({ error: "Active course not found." }, { status: 404 });
  const statuses: Record<string, ActivityStatus> = {};
  for (const [index, activity] of parseActivities(course.activities_json).entries()) {
    const id = String(activity.id || `activity-${index+1}`);
    if (activity.kind === "virtual_lab" && activity.practicalId) {
      const row = await db.prepare("SELECT status,mark,feedback,assessed_at FROM virtual_lab_submissions WHERE learner_email=? AND practical_id=? ORDER BY id DESC LIMIT 1").bind(account.profile.email,activity.practicalId).first<{status:string;mark:number|null;feedback:string;assessed_at:string|null}>();
      const maximum=Math.max(1,Number(activity.maxMark)||100),threshold=Math.min(100,Math.max(1,Number(activity.passMark)||60));
      const percentage=row?.mark===null||row?.mark===undefined?null:(Number(row.mark)/maximum)*100;
      statuses[id] = { passed:Boolean(row&&row.status==="assessed"&&percentage!==null&&percentage>=threshold&&row.feedback?.trim()), status:row?.status ?? "not_started", mark:row?.mark ?? null, feedback:row?.feedback ?? "", assessedAt:row?.assessed_at ?? null, maximum, passMark:threshold };
    } else if (activity.kind === "colab") {
      const assignment = await db.prepare("SELECT id FROM colab_assignments WHERE course_code=? AND title=? AND status='active' ORDER BY id DESC LIMIT 1").bind(courseCode,activity.title ?? "").first<{id:number}>();
      const row = assignment ? await db.prepare("SELECT status,mark,passed,feedback,assessed_at,attempt_number FROM colab_submissions WHERE assignment_id=? AND learner_email=? ORDER BY id DESC LIMIT 1").bind(assignment.id,account.profile.email).first<{status:string;mark:number|null;passed:number;feedback:string;assessed_at:string|null;attempt_number:number}>() : null;
      statuses[id] = { passed:Boolean(row?.passed && row?.feedback?.trim()), status:row?.status ?? "not_started", mark:row?.mark ?? null, feedback:row?.feedback ?? "", assessedAt:row?.assessed_at ?? null, attemptNumber:row?.attempt_number ?? null, maximum:Math.max(1,Number(activity.maxMark)||100), passMark:Math.min(100,Math.max(1,Number(activity.passMark)||60)) };
    } else if (activity.kind === "inline") {
      const row = await db.prepare("SELECT status,mark,max_mark,pass_mark,passed,feedback,criteria_json,grading_mode,model,assessed_at,attempt_number FROM material_activity_submissions WHERE user_email=? AND course_code=? AND activity_id=? ORDER BY id DESC LIMIT 1").bind(account.profile.email,courseCode,id).first<{status:string;mark:number|null;max_mark:number;pass_mark:number;passed:number;feedback:string;criteria_json:string;grading_mode:string;model:string|null;assessed_at:string|null;attempt_number:number}>();
      let criteria:unknown[]=[]; try{const parsed=JSON.parse(row?.criteria_json||"[]") as unknown; criteria=Array.isArray(parsed)?parsed:[];}catch{}
      statuses[id] = { passed:Boolean(row?.passed && row?.feedback?.trim()), status:row?.status ?? "not_started", mark:row?.mark ?? null, feedback:row?.feedback ?? "", assessedAt:row?.assessed_at ?? null, attemptNumber:row?.attempt_number ?? null, maximum:row?.max_mark ?? Math.max(1,Number(activity.maxMark)||100), passMark:row?.pass_mark ?? Math.min(100,Math.max(1,Number(activity.passMark)||60)), criteria, model:row?.model ?? null };
    }
  }
  return Response.json({ statuses });
}
