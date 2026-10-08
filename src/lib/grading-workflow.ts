import { getRawDb } from "@/db/raw";
import { gradeQuestionsWithAi } from "./assessment-ai";
import { assessmentPassMark, gradeRuleQuestions, type AssessmentConfigRecord } from "./assessment-policy";
import { evaluateCourseCompletion, issueCertificateIfComplete } from "./course-completion";
import { notify, notifyTeachers } from "./delivery-notifications";
import { parseRecord } from "./course-access";
import { recordAudit } from "./audit";

export function recomputeAssessment(database: import("node:sqlite").DatabaseSync,email:string,code:string) {
  const best=database.prepare("SELECT final_score,passed,answers_json,marked_at FROM assessment_submissions WHERE user_email=? AND course_code=? AND status='marked' AND final_score IS NOT NULL ORDER BY passed DESC,final_score DESC,id DESC LIMIT 1").get(email,code) as {final_score:number;passed:number;answers_json:string;marked_at:string}|undefined;
  // The aggregate derives only from current, final decisions. A correction can lower it.
  database.prepare(`INSERT INTO assessment_attempts(user_email,course_code,score,passed,answers_json,completed_at) VALUES(?,?,?,?,?,?) ON CONFLICT(user_email,course_code) DO UPDATE SET score=excluded.score,passed=excluded.passed,answers_json=excluded.answers_json,completed_at=excluded.completed_at`).run(email,code,best?.final_score??0,best?.passed??0,best?.answers_json??"{}",best?.marked_at??new Date().toISOString());
}
export async function reviewAffectedCredential(email:string,code:string,reason:string) {
  const db=getRawDb(),evaluation=await evaluateCourseCompletion(email,code);
  if(evaluation?.complete)return;
  db.transaction(native=>{
    const certificates=native.prepare("SELECT certificate_code FROM certificates WHERE user_email=? AND course_code=? AND status='active'").all(email,code) as {certificate_code:string}[];
    for(const cert of certificates) {
      native.prepare("INSERT OR IGNORE INTO credential_reviews(certificate_code,reason) VALUES(?,?)").run(cert.certificate_code,reason);
      native.prepare("UPDATE certificates SET status='under_review' WHERE certificate_code=?").run(cert.certificate_code);
    }
    const invalidCodes=new Set([code.toUpperCase()]);
    const broader=native.prepare("SELECT certificate_code,course_code,requirements_json FROM certificates WHERE user_email=? AND credential_type='stacked_credential' AND status='active'").all(email) as {certificate_code:string;course_code:string;requirements_json:string}[];
    let changed=true;
    while(changed){changed=false;for(const cert of broader){if(invalidCodes.has(cert.course_code.toUpperCase()))continue;const requirements=parseRecord<{stackableCredential?:{requiredCodes?:string[]}}>(cert.requirements_json,{});if(requirements.stackableCredential?.requiredCodes?.some(c=>invalidCodes.has(c.toUpperCase()))){native.prepare("INSERT OR IGNORE INTO credential_reviews(certificate_code,reason) VALUES(?,?)").run(cert.certificate_code,`Component credential requires review: ${reason}`);native.prepare("UPDATE certificates SET status='under_review' WHERE certificate_code=?").run(cert.certificate_code);invalidCodes.add(cert.course_code.toUpperCase());changed=true;}}}
    native.prepare("UPDATE enrollments SET status='active' WHERE user_email=? AND course_code=? AND status='completed'").run(email,code);
  });
}
export async function credentialEvidenceValid(certificateCode:string) {
  const db=getRawDb(),cert=await db.prepare("SELECT user_email,course_code,requirements_json FROM certificates WHERE certificate_code=?").bind(certificateCode).first<{user_email:string;course_code:string;requirements_json:string}>();
  if(!cert)return false;
  const stack=parseRecord<{stackableCredential?:{requiredCodes?:string[]}}>(cert.requirements_json,{}).stackableCredential;
  if(stack?.requiredCodes?.length){for(const code of stack.requiredCodes){if(!await db.prepare("SELECT id FROM certificates WHERE user_email=? AND course_code=? AND status='active' AND (expires_at IS NULL OR datetime(expires_at)>datetime('now'))").bind(cert.user_email,code).first())return false;}return true;}
  return Boolean((await evaluateCourseCompletion(cert.user_email,cert.course_code))?.complete);
}
export async function processGradingJobs() {
  const db=getRawDb();
  const jobs=db.transaction(native=>{
    native.prepare("UPDATE grading_jobs SET state='queued',locked_at=NULL WHERE state='processing' AND locked_at < datetime('now','-10 minutes')").run();
    const pending=native.prepare("SELECT id,submission_id,config_json,attempts FROM grading_jobs WHERE state IN ('queued','retry') AND datetime(next_attempt_at)<=datetime('now') ORDER BY id LIMIT 2").all() as {id:number;submission_id:number;config_json:string;attempts:number}[];
    for(const job of pending)native.prepare("UPDATE grading_jobs SET state='processing',attempts=attempts+1,locked_at=CURRENT_TIMESTAMP WHERE id=?").run(job.id);
    return pending;
  });
  for(const job of jobs) {
    const row=await db.prepare("SELECT * FROM assessment_submissions WHERE id=?").bind(job.submission_id).first<{id:number;user_email:string;course_code:string;status:string;answers_json:string}>();
    if(!row || !["submitted","awaiting_marking"].includes(row.status)) {await db.prepare("UPDATE grading_jobs SET state='cancelled' WHERE id=?").bind(job.id).run();continue;}
    try {
      const config=parseRecord<AssessmentConfigRecord&{markingMode?:string}>(job.config_json,{}),questions=config.questions??[],answers=parseRecord<Record<string,unknown>>(row.answers_json,{}),rule=gradeRuleQuestions(questions,answers);
      const ai=rule.aiQuestions.length?await gradeQuestionsWithAi(rule.aiQuestions,answers):[];
      const score=Math.floor(100*(rule.earned+ai.reduce((sum,item)=>sum+item.earned,0))/Math.max(1,rule.total)),passed=score>=assessmentPassMark(config),assisted=config.markingMode==="assisted";
      const feedback=[...rule.feedback.filter(f=>f.markingMode==="rule"),...ai];
      const applied=db.transaction(native=>{
        const result=native.prepare("UPDATE assessment_submissions SET status=?,auto_score=?,final_score=?,passed=?,auto_feedback_json=?,marked_at=CASE WHEN ?='marked' THEN CURRENT_TIMESTAMP ELSE NULL END WHERE id=? AND status='submitted'").run(assisted?"awaiting_marking":"marked",score,assisted?null:score,assisted?0:passed?1:0,JSON.stringify(feedback),assisted?"awaiting_marking":"marked",row.id);
        native.prepare("UPDATE grading_jobs SET state='completed',last_error=NULL,locked_at=NULL WHERE id=?").run(job.id);
        if(result.changes&&!assisted)recomputeAssessment(native,row.user_email,row.course_code);
        return Number(result.changes)>0;
      });
      if(applied) {
        await recordAudit("system","assessment.processed",{submissionId:row.id,courseCode:row.course_code,score,assisted});
        if(assisted)await notifyTeachers(row.course_code,`mark-${row.id}`,"Assessment ready for approval",`Submission ${row.id} has an AI-assisted draft. A marker must approve the final result.`);
        else {await issueCertificateIfComplete(row.user_email,row.course_code);await notify(row.user_email,`grade-${row.id}`,"assessment","Assessment feedback available",`Your result for ${row.course_code} is ${score}%.`,"/?view=assessments");}
      }
    } catch {
      const failed=job.attempts>=2;
      await db.prepare("UPDATE grading_jobs SET state=?,last_error=?,next_attempt_at=datetime('now','+2 minutes'),locked_at=NULL WHERE id=?").bind(failed?"failed":"retry","Automatic grading could not complete. Evidence is saved; a marker can grade it or retry processing.",job.id).run();
      if(failed) {await db.prepare("UPDATE assessment_submissions SET status='awaiting_marking' WHERE id=? AND status='submitted'").bind(row.id).run();await notifyTeachers(row.course_code,`grade-failed-${row.id}`,"Saved assessment needs attention",`Submission ${row.id} could not be graded automatically. Evidence is retained in the marking queue.`);}
    }
  }
  return jobs.length;
}
