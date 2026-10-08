import { getRawDb } from "@/db/raw";
import { requireActiveProfile } from "@/lib/accounts";
import { coursePermission, enrolledCourse, parseRecord } from "@/lib/course-access";
import { evidenceTables, type EvidenceType } from "@/lib/evidence-workflow";
import { getStoredFile } from "@/lib/render-storage";
import { rejectCrossSiteMutation } from "@/lib/request-security";
import { reviewAffectedCredential } from "@/lib/grading-workflow";
import { issueCertificateIfComplete } from "@/lib/course-completion";
import { ensureStructuredLearningActivities } from "@/lib/structured-learning-activities";
import type { CourseMaterialRecord } from "@/lib/course-design";
import { notify } from "@/lib/delivery-notifications";

type EvidenceRow=Record<string,unknown>&{id:number;course_code:string;learner_email:string;max_mark:number;pass_mark:number;status:string};
async function evidence(type:EvidenceType,id:number) {
  const db=getRawDb();
  if(type==="inline") {
    const row = await db.prepare("SELECT s.*,s.user_email learner_email FROM material_activity_submissions s WHERE s.id=?").bind(id).first<EvidenceRow>();
    if (!row) return null;
    const course = await enrolledCourse(row.learner_email, row.course_code);
    const activity = ensureStructuredLearningActivities(parseRecord<CourseMaterialRecord[]>(course?.materials_json, []), parseRecord<unknown[]>(course?.activities_json, [])).find(a => a.id === row.activity_id);
    return { ...row, title: activity?.title, instructions: activity?.instructions, rubric: activity?.rubric };
  }
  if(type==="colab")return db.prepare("SELECT s.*,a.course_code,a.max_mark,a.pass_mark,a.rubric FROM colab_submissions s JOIN colab_assignments a ON a.id=s.assignment_id WHERE s.id=?").bind(id).first<EvidenceRow>();
  if(type==="virtual") {const row=await db.prepare("SELECT * FROM virtual_lab_submissions WHERE id=?").bind(id).first<EvidenceRow>();if(row){const course=await enrolledCourse(row.learner_email,row.course_code),activity=parseRecord<{practicalId?:string;maxMark?:number;passMark?:number;rubric?:string}[]>(course?.activities_json,[]).find(a=>a.practicalId===row.practical_id);return {...row,max_mark:Math.max(1,Number(activity?.maxMark)||100),pass_mark:Number(activity?.passMark)||60,rubric:activity?.rubric};} }
  return null;
}
export async function GET(request:Request) {
  const account=await requireActiveProfile();if(account.error||!account.profile)return account.error;
  const p=new URL(request.url).searchParams,type=p.get("type") as EvidenceType,id=Number(p.get("id")),code=p.get("courseCode")||"",db=getRawDb();
  if(id){if(!evidenceTables[type])return Response.json({error:"Choose an evidence type."},{status:400});const row=await evidence(type,id);if(!row||(account.profile.role==="learner"?row.learner_email!==account.profile.email:!await coursePermission(account.profile,row.course_code)))return Response.json({error:"Evidence not found."},{status:404});
    if(p.get("download")==="1") {const key=String(row.evidence_key||row.notebook_key||"");if(!key)return Response.json({error:"No uploaded file for this record."},{status:404});try{const file=await getStoredFile(key);if(file.metadata.ownerEmail!==row.learner_email)return Response.json({error:"Evidence owner mismatch."},{status:403});return new Response(new Uint8Array(file.body),{headers:{"content-type":file.metadata.contentType||"application/octet-stream","content-disposition":`attachment; filename="${String(row.evidence_file_name||row.notebook_file_name||"evidence").replace(/[^A-Za-z0-9._-]/g,"_")}"`,"cache-control":"private, no-store","x-content-type-options":"nosniff"}});}catch{return Response.json({error:"Evidence file unavailable."},{status:404});}}
    return Response.json({record:row,history:(await db.prepare("SELECT * FROM evidence_grade_history WHERE target_type=? AND target_id=? ORDER BY id DESC").bind(type,id).all()).results});
  }
  if(account.profile.role==="learner"||!await coursePermission(account.profile,code))return Response.json({error:"Select a course you teach or mark."},{status:403});
  const offset = Math.max(0, Math.floor(Number(p.get("offset")) || 0));
  const filter = p.get("filter") === "pending" ? "pending" : "all";
  const result = await db.prepare(`SELECT * FROM (
    SELECT s.id,s.status,s.mark,s.passed,s.feedback,s.learner_email,s.submitted_at,a.title,a.max_mark,a.pass_mark,'colab' type FROM colab_submissions s JOIN colab_assignments a ON a.id=s.assignment_id WHERE a.course_code=?
    UNION ALL SELECT id,status,mark,passed,feedback,user_email learner_email,submitted_at,activity_id title,max_mark,pass_mark,'inline' type FROM material_activity_submissions WHERE course_code=?
    UNION ALL SELECT id,status,mark,passed,feedback,learner_email,submitted_at,practical_title title,100 max_mark,60 pass_mark,'virtual' type FROM virtual_lab_submissions WHERE course_code=?
  ) WHERE (?='all' OR status IN ('submitted','awaiting_marking')) ORDER BY submitted_at DESC,id DESC,type LIMIT 101 OFFSET ?`).bind(code, code, code, filter, offset).all<Record<string, unknown>>();
  return Response.json({ items: result.results.slice(0, 100), nextOffset: result.results.length > 100 ? offset + 100 : null });
}
export async function PATCH(request:Request) {
  const origin=rejectCrossSiteMutation(request);if(origin)return origin;const account=await requireActiveProfile(["facilitator","admin"]);if(account.error||!account.profile)return account.error;
  const p=await request.json() as {type:EvidenceType;id:number;mark:number;feedback:string;decision?:string;retry?:boolean},table=evidenceTables[p.type];if(!table)return Response.json({error:"Invalid evidence type."},{status:400});
  const row=await evidence(p.type,Number(p.id));if(!row||!await coursePermission(account.profile,row.course_code,"mark"))return Response.json({error:"Course marking permission is required."},{status:403});const db=getRawDb();
  if(p.retry){const changed=db.transaction(native=>{const job=native.prepare("UPDATE evidence_grading_jobs SET state='queued',attempts=0,next_attempt_at=CURRENT_TIMESTAMP,last_error=NULL WHERE target_type=? AND target_id=? AND state='failed'").run(p.type,row.id);return Number(job.changes);});return changed?Response.json({saved:true}):Response.json({error:"Only a failed job can be retried."},{status:409});}
  const mark=Number(p.mark),feedback=String(p.feedback||"").trim().slice(0,10000),status=p.decision==="resubmit"?"resubmit":"assessed";
  if(!Number.isFinite(mark)||mark<0||mark>row.max_mark||feedback.length<10)return Response.json({error:`Enter a valid mark from 0 to ${row.max_mark} and feedback of at least 10 characters.`},{status:400});
  const passed=status==="assessed"&&100*mark/row.max_mark>=row.pass_mark;
  db.transaction(native=>{
    native.prepare("INSERT INTO evidence_grade_history(target_type,target_id,actor_email,before_json,after_json,reason) VALUES(?,?,?,?,?,?)").run(p.type,row.id,account.profile!.email,JSON.stringify({mark:row.mark,passed:row.passed,status:row.status}),JSON.stringify({mark,passed,status}),feedback);
    native.prepare("UPDATE evidence_grading_jobs SET state='cancelled' WHERE target_type=? AND target_id=? AND state<>'completed'").run(p.type,row.id);
    const extra=p.type==="inline"?"":",assessed_by_email=?";
    native.prepare(`UPDATE ${table} SET mark=?,passed=?,status=?,feedback=?,assessed_at=CURRENT_TIMESTAMP${extra} WHERE id=?`).run(mark,passed?1:0,status,feedback,...(p.type==="inline"?[]:[account.profile!.email]),row.id);
  });
  await reviewAffectedCredential(row.learner_email,row.course_code,`Practical submission ${row.id} corrected: ${feedback}`);
  await issueCertificateIfComplete(row.learner_email,row.course_code);
  await notify(row.learner_email,`evidence-decision-${p.type}-${row.id}-${Date.now()}`,"assessment","Practical decision recorded",feedback,`/learn/${encodeURIComponent(row.course_code)}`);
  return Response.json({saved:true,passed});
}
