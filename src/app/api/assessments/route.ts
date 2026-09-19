import { getRawDb } from "@/db/raw";
import { requireActiveProfile } from "@/lib/accounts";
import { gradeQuestionsWithAi } from "@/lib/assessment-ai";
import { allowedAttempts, assessmentPassMark, gradeRuleQuestions, type AssessmentConfigRecord } from "@/lib/assessment-policy";
import { recordAudit } from "@/lib/audit";
import { evaluateCourseCompletion, issueCertificateIfComplete } from "@/lib/course-completion";
import { rejectCrossSiteMutation } from "@/lib/request-security";

type SubmissionRow={id:number;user_email:string;learner_name?:string;course_code:string;course_title?:string;attempt_number:number;status:"submitted"|"awaiting_marking"|"marked"|"resubmit";auto_score:number|null;final_score:number|null;passed:number;answers_json:string;auto_feedback_json:string;marker_feedback:string;marked_by_email:string|null;submitted_at:string;marked_at:string|null};
const parse=<T,>(value:string,fallback:T)=>{try{return JSON.parse(value||"") as T;}catch{return fallback;}};
const present=(row:SubmissionRow,evidence=false,config?:AssessmentConfigRecord)=>({id:row.id,learnerEmail:row.user_email,learnerName:row.learner_name,courseCode:row.course_code,courseTitle:row.course_title,attemptNumber:row.attempt_number,status:row.status,autoScore:row.auto_score,finalScore:row.final_score,passed:Boolean(row.passed),markerFeedback:row.marker_feedback,automaticFeedback:parse(row.auto_feedback_json,[]),markedByEmail:row.marked_by_email,submittedAt:row.submitted_at,markedAt:row.marked_at,...(evidence?{answers:parse(row.answers_json,{}),questions:config?.questions??[],passMark:assessmentPassMark(config??{})}:{})});

export async function GET(request:Request){
  const account=await requireActiveProfile(); if(account.error||!account.profile)return account.error;
  const code=new URL(request.url).searchParams.get("courseCode")?.trim()??""; const db=getRawDb();
  if(account.profile.role==="learner"){
    const rows=await db.prepare("SELECT * FROM assessment_submissions WHERE user_email=? AND (?='' OR course_code=?) ORDER BY submitted_at DESC LIMIT 100").bind(account.profile.email,code,code).all<SubmissionRow>();
    const passedAssessment=code?await db.prepare("SELECT score,passed,completed_at FROM assessment_attempts WHERE user_email=? AND course_code=? AND passed=1 LIMIT 1").bind(account.profile.email,code).first<{score:number;passed:number;completed_at:string}>():null;
    return Response.json({submissions:rows.results.map(r=>present(r)),passedAssessment:passedAssessment?{passed:Boolean(passedAssessment.passed),score:passedAssessment.score,completedAt:passedAssessment.completed_at}:null});
  }
  const base=`SELECT s.*,u.full_name learner_name,c.title course_title,c.assessment_config_json FROM assessment_submissions s JOIN course_drafts c ON c.code=s.course_code LEFT JOIN users u ON u.email=s.user_email`;
  const rows=account.profile.role==="admin"?await db.prepare(`${base} WHERE (?='' OR s.course_code=?) ORDER BY s.submitted_at DESC LIMIT 250`).bind(code,code).all<SubmissionRow&{assessment_config_json:string}>():await db.prepare(`${base} WHERE c.created_by_email=? AND (?='' OR s.course_code=?) ORDER BY s.submitted_at DESC LIMIT 250`).bind(account.profile.email,code,code).all<SubmissionRow&{assessment_config_json:string}>();
  return Response.json({submissions:rows.results.map(r=>present(r,true,parse<AssessmentConfigRecord>(r.assessment_config_json,{})))});
}

export async function POST(request:Request){
  const origin=rejectCrossSiteMutation(request);if(origin)return origin;const account=await requireActiveProfile(["learner"]);if(account.error||!account.profile)return account.error;
  const payload=await request.json() as{courseCode?:string;answers?:Record<string,unknown>};const code=payload.courseCode?.trim()??"";const db=getRawDb();
  const enrolled=await db.prepare("SELECT id FROM enrollments WHERE user_email=? AND course_code=? AND status IN ('active','completed')").bind(account.profile.email,code).first();if(!enrolled)return Response.json({error:"Enrol in this course before completing its assessment."},{status:403});
  const course=await db.prepare("SELECT assessment_config_json,question_limit FROM course_drafts WHERE code=? AND status='active'").bind(code).first<{assessment_config_json:string;question_limit:number}>();if(!course)return Response.json({error:"The active course assessment was not found."},{status:404});
  const config=parse<AssessmentConfigRecord>(course.assessment_config_json,{}),questions=(config.questions??[]).filter((question)=>question.approved===true&&question.previewed===true).slice(0,course.question_limit||100),answers=payload.answers??{};if(!questions.length)return Response.json({error:"This course does not yet have a previewed and approved assessment."},{status:409});
  const alreadyPassed=await db.prepare("SELECT passed,score,completed_at FROM assessment_attempts WHERE user_email=? AND course_code=? AND passed=1 LIMIT 1").bind(account.profile.email,code).first<{passed:number;score:number;completed_at:string}>();
  if(alreadyPassed)return Response.json({error:"You have already passed this course assessment. The completed course remains available for review, but a second certificate cannot be earned for the same course.",alreadyPassed:true,score:alreadyPassed.score,completedAt:alreadyPassed.completed_at},{status:409});

  const completionBefore=await evaluateCourseCompletion(account.profile.email,code);
  const incompleteLearning=(completionBefore?.requirements??[]).filter((item)=>["content","virtual_lab","colab"].includes(item.type)&&!item.complete);
  if(incompleteLearning.length)return Response.json({error:`Complete the required learning activities before the final assessment (${incompleteLearning.map((item)=>item.label).slice(0,3).join(", ")}${incompleteLearning.length>3?"…":""}).`,requirements:incompleteLearning},{status:409});

  const missing=questions.filter(q=>answers[q.id]===undefined||answers[q.id]===null||(typeof answers[q.id]==="string"&&!String(answers[q.id]).trim()));if(missing.length)return Response.json({error:`Answer every item before submission (${missing.length} incomplete).`},{status:400});
  const count=await db.prepare("SELECT COUNT(*) count FROM assessment_submissions WHERE user_email=? AND course_code=?").bind(account.profile.email,code).first<{count:number}>();const attempt=Number(count?.count??0)+1,max=allowedAttempts(config);if(attempt>max)return Response.json({error:"The permitted number of attempts has been used."},{status:409});
  const pending=await db.prepare("SELECT id FROM assessment_submissions WHERE user_email=? AND course_code=? AND status IN ('submitted','awaiting_marking')").bind(account.profile.email,code).first();if(pending)return Response.json({error:"Your previous submission is still being processed."},{status:409});

  const rule=gradeRuleQuestions(questions,answers);
  let aiGrades:Awaited<ReturnType<typeof gradeQuestionsWithAi>>=[];
  try { if(rule.aiQuestions.length) aiGrades=await gradeQuestionsWithAi(rule.aiQuestions,answers); }
  catch(error){ return Response.json({error:error instanceof Error?error.message:"Automated rubric grading could not be completed. Please submit again."},{status:503}); }
  const aiEarned=aiGrades.reduce((sum,item)=>sum+item.earned,0),earned=rule.earned+aiEarned,total=Math.max(1,rule.total);
  // Deliberately floor rather than round up: a raw 59.x score never becomes a passing 60.
  const finalScore=Math.floor((earned/total)*100),passMark=assessmentPassMark(config),passed=finalScore>=passMark;
  const combinedFeedback=[...rule.feedback,...aiGrades.map((item)=>({questionId:item.questionId,correct:null,earned:item.earned,available:item.available,markingMode:"ai",model:item.model,feedback:item.feedback,learnerAdvice:item.learnerAdvice,criteria:item.criteria,cachedInputTokens:item.cachedInputTokens}))];
  const saved=await db.prepare(`INSERT INTO assessment_submissions(user_email,course_code,attempt_number,status,auto_score,final_score,passed,answers_json,auto_feedback_json,marked_at) VALUES(?,?,?,'marked',?,?,?,?,?,CURRENT_TIMESTAMP)`).bind(account.profile.email,code,attempt,finalScore,finalScore,passed?1:0,JSON.stringify(answers),JSON.stringify(combinedFeedback)).run();
  await db.prepare(`INSERT INTO assessment_attempts(user_email,course_code,score,passed,answers_json,completed_at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(user_email,course_code) DO UPDATE SET score=MAX(score,excluded.score),passed=MAX(passed,excluded.passed),answers_json=CASE WHEN excluded.score>=score THEN excluded.answers_json ELSE answers_json END,completed_at=CURRENT_TIMESTAMP`).bind(account.profile.email,code,finalScore,passed?1:0,JSON.stringify(answers)).run();
  await recordAudit(account.profile.email,"assessment.automatically_graded",{submissionId:saved.meta.last_row_id,courseCode:code,attempt,score:finalScore,passMark,passed,ruleQuestions:questions.length-rule.aiQuestions.length,aiQuestions:rule.aiQuestions.length,models:[...new Set(aiGrades.map((item)=>item.model))]});
  const completion=passed?await issueCertificateIfComplete(account.profile.email,code):{evaluation:await evaluateCourseCompletion(account.profile.email,code),certificate:null};
  return Response.json({submissionId:saved.meta.last_row_id,attemptNumber:attempt,attemptsAllowed:max,status:"marked",awaitingMarking:false,score:finalScore,passMark,passed,feedback:combinedFeedback,certificate:completion.certificate,completion:completion.evaluation},{status:201});
}

// Retained only for authorised correction of legacy/manual records; normal learner grading is automatic.
export async function PATCH(request:Request){
  const origin=rejectCrossSiteMutation(request);if(origin)return origin;const account=await requireActiveProfile(["facilitator","admin"]);if(account.error||!account.profile)return account.error;
  const payload=await request.json() as{id?:number;decision?:"marked"|"resubmit";finalScore?:number;feedback?:string};const id=Number(payload.id),feedback=String(payload.feedback??"").trim().slice(0,10000);if(!Number.isInteger(id)||id<1||!["marked","resubmit"].includes(payload.decision??""))return Response.json({error:"Choose a valid correction decision."},{status:400});if(!feedback)return Response.json({error:"Record the reason and learner feedback for this correction."},{status:400});
  const db=getRawDb(),row=await db.prepare(`SELECT s.*,c.created_by_email,c.assessment_config_json FROM assessment_submissions s JOIN course_drafts c ON c.code=s.course_code WHERE s.id=?`).bind(id).first<SubmissionRow&{created_by_email:string;assessment_config_json:string}>();if(!row)return Response.json({error:"Submission not found."},{status:404});if(account.profile.role!=="admin"&&row.created_by_email!==account.profile.email)return Response.json({error:"You may correct only your own course records."},{status:403});
  const config=parse<AssessmentConfigRecord>(row.assessment_config_json,{}),passMark=assessmentPassMark(config),supplied=Number(payload.finalScore);if(payload.decision==="marked"&&(!Number.isFinite(supplied)||supplied<0||supplied>100))return Response.json({error:"Enter a final score from 0 to 100."},{status:400});const score=payload.decision==="marked"?Math.floor(supplied):null,passed=score!==null&&score>=passMark;
  await db.prepare("UPDATE assessment_submissions SET status=?,final_score=?,passed=?,marker_feedback=?,marked_by_email=?,marked_at=CURRENT_TIMESTAMP WHERE id=?").bind(payload.decision,score,passed?1:0,feedback,account.profile.email,id).run();if(score!==null)await db.prepare(`INSERT INTO assessment_attempts(user_email,course_code,score,passed,answers_json,completed_at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(user_email,course_code) DO UPDATE SET score=MAX(score,excluded.score),passed=MAX(passed,excluded.passed),answers_json=CASE WHEN excluded.score>=score THEN excluded.answers_json ELSE answers_json END,completed_at=CURRENT_TIMESTAMP`).bind(row.user_email,row.course_code,score,passed?1:0,row.answers_json).run();
  await recordAudit(account.profile.email,"assessment.authorised_correction",{submissionId:id,learnerEmail:row.user_email,courseCode:row.course_code,score,passed});const completion=passed?await issueCertificateIfComplete(row.user_email,row.course_code):{evaluation:await evaluateCourseCompletion(row.user_email,row.course_code),certificate:null};return Response.json({updated:true,status:payload.decision,finalScore:score,passed,completion:completion.evaluation,certificate:completion.certificate});
}
