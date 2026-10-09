import { recordAudit } from "@/lib/audit";
import { after } from "next/server";
import { requireActiveProfile } from "@/lib/accounts";
import { getRawDb } from "@/db/raw";
import { aiDailyLimit, aiEstimatedCost, ensureAiTables, processCourseAiJob, queueCourseAi, recoverStaleAiJobs } from "@/lib/course-ai-jobs";
import { rejectCrossSiteMutation } from "@/lib/request-security";
export async function GET() {
  const account = await requireActiveProfile(["admin","facilitator"]); if (account.error || !account.profile) return account.error;
  await recoverStaleAiJobs(); const db = getRawDb();
  const rows = await db.prepare("SELECT id,status,proposal_json,error,created_at,input_tokens,output_tokens,json_extract(input_json,'$.mode') mode,json_extract(input_json,'$.targetMaterialId') target_material_id,json_extract(input_json,'$.targetCourseCode') target_course_code FROM course_ai_jobs WHERE owner_email=? AND COALESCE(json_extract(input_json,'$.verification'),0)!=1 ORDER BY created_at DESC LIMIT 15").bind(account.profile.email).all<{id:string;status:string;proposal_json:string|null;error:string|null;created_at:string;input_tokens:number;output_tokens:number;mode:string;target_material_id:string;target_course_code:string}>();
  for (const row of rows.results.filter(r => r.status === "queued")) after(() => processCourseAiJob(row.id));
  const usage = await db.prepare("SELECT COALESCE(SUM(request_units),0) requests,SUM(input_tokens) inputTokens,SUM(output_tokens) outputTokens FROM course_ai_jobs WHERE owner_email=? AND date(created_at)=date('now')").bind(account.profile.email).first<{requests:number;inputTokens:number;outputTokens:number}>();
  const institutionUsage = account.profile.role === "admin" ? (await db.prepare("SELECT owner_email,SUM(request_units) requests,SUM(input_tokens) input_tokens,SUM(output_tokens) output_tokens FROM course_ai_jobs WHERE date(created_at)=date('now') GROUP BY owner_email").all()).results : undefined;
  const progress = await db.prepare("SELECT s.job_id,COUNT(*) total,SUM(s.status='completed') completed FROM course_ai_job_sections s JOIN course_ai_jobs j ON j.id=s.job_id WHERE j.owner_email=? GROUP BY s.job_id").bind(account.profile.email).all<{job_id:string;total:number;completed:number}>();
  return Response.json({ jobs: rows.results.map(r=>({id:r.id,status:r.status,mode:r.mode,targetMaterialId:r.target_material_id,targetCourseCode:r.target_course_code,proposal:r.proposal_json?JSON.parse(r.proposal_json):undefined,error:r.error,createdAt:r.created_at,progress:progress.results.find(p=>p.job_id===r.id)})),usage:{...usage,estimatedUsd:aiEstimatedCost(usage?.inputTokens||0,usage?.outputTokens||0)}, dailyLimit:aiDailyLimit(), institutionUsage,admin:account.profile.role==="admin" });
}
export async function POST(request:Request) {
  const origin = rejectCrossSiteMutation(request); if(origin)return origin;
  const account=await requireActiveProfile(["admin","facilitator"]);if(account.error||!account.profile)return account.error;
  ensureAiTables(); const body=await request.json() as {id?:string;action?:string;approvedOutline?:string};
  const row=await getRawDb().prepare("SELECT input_json,status FROM course_ai_jobs WHERE id=? AND owner_email=?").bind(String(body.id||""),account.profile.email).first<{input_json:string;status:string}>();
  if(!row||(body.action==="develop"?row.status!=="completed":row.status!=="failed"))return Response.json({error:"Only your failed requests can be retried."},{status:409});
  try { const input=JSON.parse(row.input_json); if(body.action==="develop"){if(input.stage!=="outline")return Response.json({error:"Only an approved outline can be developed."},{status:409});input.stage="lessons";input.generationStrategy="sectioned";input.approvedOutline=String(body.approvedOutline||"").slice(0,24000);} const id=queueCourseAi(account.profile.email,input,body.action==="develop"?undefined:body.id);after(()=>processCourseAiJob(id));return Response.json({job:{id,status:"queued"}},{status:202}); }
  catch(e){return Response.json({error:e instanceof Error?e.message:"Retry unavailable."},{status:429});}
}

export async function PATCH(request:Request) {
  const origin=rejectCrossSiteMutation(request);if(origin)return origin;
  const account=await requireActiveProfile(["admin"]);if(account.error||!account.profile)return account.error;
  const body=await request.json() as {dailyLimit?:number};const limit=Number(body.dailyLimit);
  if(!Number.isInteger(limit)||limit<1||limit>500)return Response.json({error:"Set a daily limit between 1 and 500."},{status:400});
  await getRawDb().prepare("INSERT INTO platform_settings(setting_key,setting_value,updated_by_email) VALUES('course_ai_daily_limit',?,?) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_by_email=excluded.updated_by_email,updated_at=CURRENT_TIMESTAMP").bind(String(limit),account.profile.email).run();
  await recordAudit(account.profile.email,"course.ai_limit_changed",{dailyLimit:limit});return Response.json({dailyLimit:limit});
}
