import { after } from "next/server";
import { getRawDb } from "@/db/raw";
import { requireActiveProfile } from "@/lib/accounts";
import { allowedAttempts, assessmentPassMark, type AssessmentConfigRecord } from "@/lib/assessment-policy";
import { recordAudit } from "@/lib/audit";
import { evaluateCourseCompletion, issueCertificateIfComplete } from "@/lib/course-completion";
import { rejectCrossSiteMutation } from "@/lib/request-security";
import { coursePermission, enrolledCourse, learningAccess, parseRecord, recordEngagement } from "@/lib/course-access";
import { normalizeCourseDesign } from "@/lib/course-design";
import { processGradingJobs, recomputeAssessment, reviewAffectedCredential } from "@/lib/grading-workflow";
import { notify, notifyTeachers } from "@/lib/delivery-notifications";

type Submission={id:number;user_email:string;course_code:string;status:string;final_score:number|null;passed:number;answers_json:string;auto_feedback_json:string;[key:string]:unknown};
function present(row:Submission,staff=false) { return {...row,learnerEmail:row.user_email,learnerName:row.learner_name,courseCode:row.course_code,courseTitle:row.course_title,attemptNumber:row.attempt_number,autoScore:row.auto_score,finalScore:row.final_score,passed:Boolean(row.passed),markerFeedback:row.marker_feedback,automaticFeedback:parseRecord(row.auto_feedback_json,[]),submittedAt:row.submitted_at,markedAt:row.marked_at,markedByEmail:row.marked_by_email,answers:parseRecord(row.answers_json,{}),...(staff?{questions:parseRecord<AssessmentConfigRecord>(String(row.assessment_config_json??"{}"),{}).questions??[],passMark:assessmentPassMark(parseRecord(String(row.assessment_config_json??"{}"),{}))}:{assessment_config_json:undefined})}; }
export async function GET(request:Request) {
  const account=await requireActiveProfile();if(account.error||!account.profile)return account.error;
  const db=getRawDb(),params=new URL(request.url).searchParams,code=params.get("courseCode")||"",before=Number(params.get("before"))||Number.MAX_SAFE_INTEGER,id=Number(params.get("id"))||0;
  const rows=await db.prepare(`SELECT s.*,u.full_name learner_name,c.title course_title,COALESCE(json_extract(e.course_snapshot_json,'$.assessment_config_json'),c.assessment_config_json) assessment_config_json,j.state processing_state,j.last_error FROM assessment_submissions s JOIN course_drafts c ON c.code=s.course_code LEFT JOIN users u ON u.email=s.user_email LEFT JOIN enrollments e ON e.user_email=s.user_email AND e.course_code=s.course_code LEFT JOIN grading_jobs j ON j.submission_id=s.id WHERE (?='' OR s.course_code=?) AND s.id<? AND (?=0 OR s.id=?) ${account.profile.role==="learner"?"AND s.user_email=?":"AND (c.created_by_email=? OR ?='admin' OR EXISTS(SELECT 1 FROM course_team t WHERE t.course_code=c.code AND t.user_email=?))"} ORDER BY s.id DESC LIMIT 101`).bind(code,code,before,id,id,...(account.profile.role==="learner"?[account.profile.email]:[account.profile.email,account.profile.role,account.profile.email])).all<Submission>();
  const passedAssessment=code?await db.prepare("SELECT score,passed,completed_at FROM assessment_attempts WHERE user_email=? AND course_code=? AND passed=1").bind(account.profile.email,code).first():null;
  return Response.json({submissions:rows.results.slice(0,100).map(row=>present(row,account.profile!.role!=="learner")),nextCursor:rows.results.length>100?rows.results[99].id:null,passedAssessment});
}
export async function POST(request:Request) {
  const origin=rejectCrossSiteMutation(request);if(origin)return origin;
  const account=await requireActiveProfile(["learner"]);if(account.error||!account.profile)return account.error;
  const payload=await request.json() as {courseCode?:string;answers?:Record<string,unknown>},code=String(payload.courseCode||""),access=await learningAccess(account.profile,code);if(access.error||!access.course)return access.error;
  const course=access.course,design=normalizeCourseDesign(parseRecord(course.design_json,{})),config=parseRecord<AssessmentConfigRecord>(course.assessment_config_json,{}),questions=(config.questions??[]).filter(q=>q.approved&&q.previewed).slice(0,course.question_limit||100),answers=payload.answers;
  if(!answers||typeof answers!=="object"||Array.isArray(answers)||JSON.stringify(answers).length>200000)return Response.json({error:"Supply valid assessment answers."},{status:400});
  if(!questions.length)return Response.json({error:"No approved assessment is available."},{status:409});
  if(design.delivery.assessmentDueAt&&Date.parse(design.delivery.assessmentDueAt)<Date.now())return Response.json({error:"The assessment deadline has passed. Ask your facilitator for support."},{status:409});
  if(questions.some(q=>answers[q.id]==null||String(answers[q.id]).trim()===""))return Response.json({error:"Answer each assessment item before submitting."},{status:400});
  const evaluation=await evaluateCourseCompletion(account.profile.email,code);
  if(evaluation?.requirements.some(r=>["content","learning_activity","virtual_lab","colab"].includes(r.type)&&!r.complete))return Response.json({error:"Complete the required learning before submitting."},{status:409});
  const db=getRawDb(),mode=design.delivery.markingMode;
  const saved=db.transaction(native=>{
    if(native.prepare("SELECT id FROM assessment_attempts WHERE user_email=? AND course_code=? AND passed=1").get(account.profile!.email,code))return {error:"This assessment is already passed."};
    if(native.prepare("SELECT id FROM assessment_submissions WHERE user_email=? AND course_code=? AND status IN ('submitted','awaiting_marking')").get(account.profile!.email,code))return {error:"Your saved submission is awaiting grading."};
    const count=native.prepare("SELECT COALESCE(MAX(attempt_number),0) count FROM assessment_submissions WHERE user_email=? AND course_code=?").get(account.profile!.email,code) as {count:number};
    const attempt=count.count+1;if(attempt>allowedAttempts(config))return {error:"The allowed assessment attempts have been used."};
    const result=native.prepare("INSERT INTO assessment_submissions(user_email,course_code,attempt_number,status,answers_json) VALUES(?,?,?,?,?)").run(account.profile!.email,code,attempt,mode==="human"?"awaiting_marking":"submitted",JSON.stringify(answers));
    const id=Number(result.lastInsertRowid);
    if(mode!=="human")native.prepare("INSERT INTO grading_jobs(submission_id,config_json) VALUES(?,?)").run(id,JSON.stringify({...config,questions,markingMode:mode}));
    native.prepare("DELETE FROM learner_workspace WHERE user_email=? AND course_code=? AND item_key='assessment-draft'").run(account.profile!.email,code);
    return {id,attempt};
  });
  if("error" in saved)return Response.json({error:saved.error},{status:409});
  await recordEngagement(account.profile.email,code,"assessment");
  await notifyTeachers(code,`submitted-${saved.id}`,"Assessment submitted",`Submission ${saved.id} is saved. ${mode==="human"?"Human marking is required.":"Processing is queued."}`);
  await recordAudit(account.profile.email,"assessment.submitted",{submissionId:saved.id,courseCode:code,mode});
  if(mode!=="human")after(()=>processGradingJobs().then(()=>{}));
  return Response.json({submissionId:saved.id,attemptNumber:saved.attempt,attemptsAllowed:allowedAttempts(config),status:mode==="human"?"awaiting_marking":"submitted",awaitingMarking:true,receipt:`UGP-AS-${saved.id}`,completion:evaluation},{status:202});
}
export async function PATCH(request:Request) {
  const origin=rejectCrossSiteMutation(request);if(origin)return origin;
  const account=await requireActiveProfile(["facilitator","admin"]);if(account.error||!account.profile)return account.error;
  const p=await request.json() as {id?:number;decision?:string;finalScore?:number;feedback?:string},db=getRawDb(),id=Number(p.id),row=await db.prepare("SELECT * FROM assessment_submissions WHERE id=?").bind(id).first<Submission>();
  if(!row)return Response.json({error:"Submission not found."},{status:404});
  if(!await coursePermission(account.profile,row.course_code,"mark"))return Response.json({error:"You are not assigned to mark this course."},{status:403});
  const feedback=String(p.feedback||"").trim().slice(0,10000),score=Number(p.finalScore);
  if(!["marked","resubmit"].includes(p.decision||"")||feedback.length<10||(p.decision==="marked"&&(!Number.isFinite(score)||score<0||score>100)))return Response.json({error:"Record a valid decision, score and feedback explaining the decision."},{status:400});
  const course=await enrolledCourse(row.user_email,row.course_code),config=parseRecord<AssessmentConfigRecord>(course?.assessment_config_json,{}),passed=p.decision==="marked"&&score>=assessmentPassMark(config);
  db.transaction(native=>{
    native.prepare("INSERT INTO grade_history(submission_id,actor_email,previous_score,new_score,previous_status,new_status,reason) VALUES(?,?,?,?,?,?,?)").run(id,account.profile!.email,row.final_score,p.decision==="marked"?score:null,row.status,p.decision!,feedback);
    native.prepare("UPDATE grading_jobs SET state='cancelled' WHERE submission_id=? AND state<>'completed'").run(id);
    native.prepare("UPDATE assessment_submissions SET status=?,final_score=?,passed=?,marker_feedback=?,marked_by_email=?,marked_at=CURRENT_TIMESTAMP WHERE id=?").run(p.decision!,p.decision==="marked"?score:null,passed?1:0,feedback,account.profile!.email,id);
    recomputeAssessment(native,row.user_email,row.course_code);
  });
  await reviewAffectedCredential(row.user_email,row.course_code,`Assessment ${id} corrected: ${feedback}`);
  const completion=await issueCertificateIfComplete(row.user_email,row.course_code);
  await recordAudit(account.profile.email,"assessment.marked",{submissionId:id,score,decision:p.decision,passed});
  await notify(row.user_email,`decision-${id}-${Date.now()}`,"assessment","Assessment decision recorded",feedback,"/?view=assessments");
  return Response.json({saved:true,passed,...completion});
}
