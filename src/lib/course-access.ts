import { getRawDb } from "@/db/raw";
import type { AccountProfile } from "./accounts";
import { normalizeCourseDesign } from "./course-design";

export type DeliveryCourse = { code:string;title:string;materials_json:string;activities_json:string;assessment_config_json:string;design_json:string;question_limit:number;certificate_enabled:number;certificate_preapproved:number;approval_reference:string|null;approval_authority:string|null;created_by_email:string;version_number:number;status:string };
export const parseRecord = <T,>(input: string | null | undefined, fallback:T):T => { try { return JSON.parse(input || "") as T; } catch { return fallback; } };
export async function coursePermission(profile: Pick<AccountProfile,"email"|"role">, code:string, action:"view"|"teach"|"mark"|"moderate"|"manage"="view") {
  const db=getRawDb();
  const course=await db.prepare("SELECT created_by_email FROM course_drafts WHERE code=? LIMIT 1").bind(code).first<{created_by_email:string}>();
  if(!course) return false;
  if(profile.role==="admin" || (profile.role==="facilitator" && course.created_by_email===profile.email)) return true;
  if(profile.role==="learner") return action==="view" && Boolean(await db.prepare("SELECT id FROM enrollments WHERE user_email=? AND course_code=? AND status IN ('active','completed')").bind(profile.email,code).first());
  const team=await db.prepare("SELECT team_role FROM course_team WHERE course_code=? AND user_email=?").bind(code,profile.email).first<{team_role:string}>();
  if(!team) return false;
  if(action==="view") return true;
  if(action==="manage") return false;
  if(action==="mark") return ["cofacilitator","marker"].includes(team.team_role);
  if(action==="moderate") return ["cofacilitator","moderator"].includes(team.team_role);
  return team.team_role==="cofacilitator";
}
export async function enrolledCourse(email:string,code:string):Promise<DeliveryCourse|null> {
  const row=await getRawDb().prepare("SELECT c.*,e.course_snapshot_json FROM course_drafts c JOIN enrollments e ON e.course_code=c.code WHERE e.user_email=? AND c.code=? AND e.status IN ('active','completed') LIMIT 1").bind(email,code).first<DeliveryCourse&{course_snapshot_json:string|null}>();
  if(!row) return null;
  return {...row,...parseRecord<Partial<DeliveryCourse>>(row.course_snapshot_json,{})};
}
export async function snapshotEnrollment(email:string,code:string) {
  const db=getRawDb();
  const course=await db.prepare("SELECT * FROM course_drafts WHERE code=? LIMIT 1").bind(code).first<DeliveryCourse>();
  if(!course)return;
  await db.prepare("UPDATE enrollments SET course_snapshot_json=? WHERE user_email=? AND course_code=? AND course_snapshot_json IS NULL").bind(JSON.stringify(course),email,code).run();
}
export async function learningAccess(profile:AccountProfile,code:string) {
  const course=await enrolledCourse(profile.email,code);
  if(!course) return {course:null,error:Response.json({error:"An active enrolment is required."},{status:403})};
  const design=normalizeCourseDesign(parseRecord(course.design_json,{}));
  if(design.delivery.identityRequired==="before_learning" && profile.identity_status!=="verified") return {course:null,error:Response.json({error:"This course requires identity verification before learning. Submit evidence in your profile."},{status:403})};
  return {course,error:null};
}
export async function recordEngagement(email:string,code:string,event="lesson") {
  await getRawDb().prepare("INSERT OR IGNORE INTO engagement_events(user_email,course_code,event_type,event_day) VALUES(?,?,?,?)").bind(email,code,event,new Date().toISOString().slice(0,10)).run();
}
export function enrolWithSnapshot(email:string,code:string) {
  return getRawDb().transaction(native=>{
    const existing=native.prepare("SELECT status FROM enrollments WHERE user_email=? AND course_code=?").get(email,code) as {status:string}|undefined;
    if(existing)return existing.status==="withdrawn"?{error:"Contact learner support to reopen a withdrawn enrolment."}:{enrolled:true};
    const course=native.prepare("SELECT * FROM course_drafts WHERE code=? AND status='active' LIMIT 1").get(code) as DeliveryCourse|undefined;
    if(!course)return {error:"The approved course is not open."};
    const run=native.prepare("SELECT enrolment_closes_at,capacity FROM course_runs WHERE offering_code=?").get(code) as {enrolment_closes_at:string;capacity:number}|undefined;
    if(run?.enrolment_closes_at&&Date.parse(run.enrolment_closes_at)<Date.now())return {error:"Enrolment for this intake has closed."};
    if(run?.capacity){const count=native.prepare("SELECT COUNT(*) count FROM enrollments WHERE course_code=? AND status IN ('active','completed')").get(code) as {count:number};if(count.count>=run.capacity)return {error:"This intake has reached its capacity."};}
    native.prepare("INSERT INTO enrollments(user_email,course_code,status,course_snapshot_json) VALUES(?,?,'active',?)").run(email,code,JSON.stringify(course));
    return {enrolled:true};
  });
}
