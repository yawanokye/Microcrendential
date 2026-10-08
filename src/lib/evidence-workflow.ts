import { getRawDb } from "@/db/raw";
import { gradeActivityEvidenceWithAi } from "./assessment-ai";
import { parseRecord, recordEngagement } from "./course-access";
import { notify, notifyTeachers } from "./delivery-notifications";
import { issueCertificateIfComplete } from "./course-completion";

export const evidenceTables={inline:"material_activity_submissions",colab:"colab_submissions",virtual:"virtual_lab_submissions"} as const;
export type EvidenceType=keyof typeof evidenceTables;
type Input=Parameters<typeof gradeActivityEvidenceWithAi>[0];
export async function queueEvidence(type:EvidenceType,id:number,code:string,email:string,input:Input,passMark:number) {
  await getRawDb().prepare("INSERT INTO evidence_grading_jobs(target_type,target_id,course_code,user_email,config_json,payload_json) VALUES(?,?,?,?,?,?)").bind(type,id,code,email,JSON.stringify({passMark,maxMark:input.maxMark}),JSON.stringify(input)).run();
  await recordEngagement(email,code,"evidence");
  await notifyTeachers(code,`evidence-${type}-${id}`,"Practical evidence saved",`Submission ${id} is saved and queued for grading.`);
}
export async function processEvidenceJobs() {
  const db=getRawDb(),jobs=db.transaction(native=>{
    native.prepare("UPDATE evidence_grading_jobs SET state='queued',locked_at=NULL WHERE state='processing' AND locked_at<datetime('now','-10 minutes')").run();
    const rows=native.prepare("SELECT * FROM evidence_grading_jobs WHERE state IN ('queued','retry') AND datetime(next_attempt_at)<=datetime('now') ORDER BY id LIMIT 2").all() as {id:number;target_type:EvidenceType;target_id:number;course_code:string;user_email:string;payload_json:string;config_json:string;attempts:number}[];
    for(const row of rows)native.prepare("UPDATE evidence_grading_jobs SET state='processing',attempts=attempts+1,locked_at=CURRENT_TIMESTAMP WHERE id=?").run(row.id);
    return rows;
  });
  for(const job of jobs) {
    const table=evidenceTables[job.target_type];if(!table)continue;
    const row=await db.prepare(`SELECT status FROM ${table} WHERE id=?`).bind(job.target_id).first<{status:string}>();
    if(row?.status!=="submitted"){await db.prepare("UPDATE evidence_grading_jobs SET state='cancelled' WHERE id=?").bind(job.id).run();continue;}
    try {
      const input=parseRecord<Input>(job.payload_json,{} as Input),config=parseRecord<{passMark:number;maxMark:number}>(job.config_json,{passMark:60,maxMark:100}),grade=await gradeActivityEvidenceWithAi(input),mark=Math.min(config.maxMark,Math.max(0,Math.floor(grade.earned))),passed=100*mark/config.maxMark>=config.passMark,feedback=[grade.feedback,grade.learnerAdvice].filter(Boolean).join("\n\n");
      if(!feedback.trim())throw new Error("Feedback required.");
      const applied=db.transaction(native=>{
        const extra=job.target_type==="inline"?",criteria_json=?,model=?":",assessed_by_email=?";
        const params=job.target_type==="inline"?[JSON.stringify(grade.criteria),grade.model]:[`AI:${grade.model}`];
        const result=native.prepare(`UPDATE ${table} SET status='assessed',mark=?,passed=?,feedback=?,assessed_at=CURRENT_TIMESTAMP${extra} WHERE id=? AND status='submitted'`).run(mark,passed?1:0,feedback,...params,job.target_id);
        native.prepare("UPDATE evidence_grading_jobs SET state='completed',locked_at=NULL,last_error=NULL,payload_json='{}' WHERE id=?").run(job.id);
        return Number(result.changes)>0;
      });
      if(applied){await issueCertificateIfComplete(job.user_email,job.course_code);await notify(job.user_email,`evidence-result-${job.target_type}-${job.target_id}`,"assessment","Practical feedback available",feedback,`/learn/${encodeURIComponent(job.course_code)}`);}
    }catch {
      await db.prepare("UPDATE evidence_grading_jobs SET state=?,last_error=?,locked_at=NULL,next_attempt_at=datetime('now','+2 minutes') WHERE id=?").bind(job.attempts>=2?"failed":"retry","Automatic grading could not complete. Evidence is retained for a marker or retry.",job.id).run();
      if(job.attempts>=2)await notifyTeachers(job.course_code,`evidence-failed-${job.target_type}-${job.target_id}`,"Practical submission needs marking",`Submission ${job.target_id} remains saved. Grade it in the evidence queue or retry processing.`);
    }
  }
  return jobs.length;
}
