import { getRawDb } from "@/db/raw";
import { enrolledCourse, parseRecord } from "./course-access";
import { normalizeCourseDesign, type CourseMaterialRecord } from "./course-design";
import { evaluateCourseCompletion } from "./course-completion";

export async function learnerCourseRecord(email:string,code:string) {
  const db=getRawDb(),course=await enrolledCourse(email,code);if(!course)return null;
  const materials=parseRecord<CourseMaterialRecord[]>(course.materials_json,[]).map((m,i)=>({...m,id:m.id||`material-${i+1}`}));
  const rows=await db.prepare("SELECT material_id,completed,last_position,updated_at FROM learning_progress WHERE user_email=? AND course_code=? ORDER BY updated_at DESC,id DESC").bind(email,code).all<{material_id:string;completed:number;last_position:number;updated_at:string}>();
  const required=materials.filter(m=>m.required!==false),done=new Set(rows.results.filter(r=>r.completed).map(r=>r.material_id)),last=rows.results[0],design=normalizeCourseDesign(parseRecord(course.design_json,{}));
  const evaluation=await evaluateCourseCompletion(email,code);
  const learningRequirements=(evaluation?.requirements??[]).filter(r=>["content","learning_activity","colab","virtual_lab"].includes(r.type));
  const percent=learningRequirements.length?Math.round(100*learningRequirements.filter(r=>r.complete).length/learningRequirements.length):(required.length?Math.round(100*required.filter(m=>done.has(m.id)).length/required.length):0);
  const attempts=await db.prepare("SELECT id,attempt_number,status,final_score,passed,marker_feedback,submitted_at,marked_at FROM assessment_submissions WHERE user_email=? AND course_code=? ORDER BY id DESC LIMIT 20").bind(email,code).all();
  return {courseCode:code,title:course.title,version:course.version_number,progress:percent,lastMaterialId:last?.material_id??materials[0]?.id??null,lastPosition:last?.last_position??0,lastActivityAt:last?.updated_at??null,resumeUrl:`/learn/${encodeURIComponent(code)}/${encodeURIComponent(last?.material_id??materials[0]?.id??"")}`,completedMaterialIds:[...done],assessmentDueAt:design.delivery.assessmentDueAt,feedbackDays:design.delivery.feedbackDays,markingMode:design.delivery.markingMode,requirements:evaluation?.requirements??[],complete:evaluation?.complete??false,attempts:attempts.results};
}
export async function usageReport(month:string) {
  const db=getRawDb();
  const settings=await db.prepare("SELECT setting_value FROM platform_settings WHERE setting_key='usage_billing'").first<{setting_value:string}>();
  const config=parseRecord<{definition?:string;rateGhs?:number}>(settings?.setting_value,{}),definition=config.definition==="enrolled"?"enrolled":"engaged",rateGhs=Math.max(0,Number(config.rateGhs)||0);
  const query=definition==="engaged"?`SELECT u.email,u.full_name,COUNT(DISTINCT e.course_code) courses,MAX(e.created_at) last_activity FROM users u JOIN engagement_events e ON e.user_email=u.email WHERE u.role='learner' AND u.is_test_record=0 AND e.event_day LIKE ? GROUP BY u.email ORDER BY u.email`:`SELECT u.email,u.full_name,COUNT(DISTINCT e.course_code) courses,MAX(e.enrolled_at) last_activity FROM users u JOIN enrollments e ON e.user_email=u.email WHERE u.role='learner' AND u.is_test_record=0 AND e.status IN ('active','completed') AND substr(e.enrolled_at,1,7)<=? GROUP BY u.email ORDER BY u.email`;
  const rows=await db.prepare(query).bind(definition==="engaged"?`${month}-%`:month).all<{email:string;full_name:string;courses:number;last_activity:string}>();
  return {month,definition,definitionText:definition==="engaged"?"Distinct non-test learners with a saved lesson, assessment or evidence event in this UTC calendar month.":"Distinct non-test learners with active or completed enrolments created by the end of this month, as recorded when this report is frozen.",billableUsers:rows.results.length,rateGhs,totalGhs:Math.round(rows.results.length*rateGhs*100)/100,users:rows.results,excludes:"Staff accounts and accounts explicitly marked as test records. Learner fees are separate UCC receipts.",generatedAt:new Date().toISOString()};
}
