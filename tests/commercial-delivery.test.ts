import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { getRawDb } from "../src/db/raw";
import { defaultCourseDesign } from "../src/lib/course-design";
import { coursePermission, enrolledCourse, enrolWithSnapshot, recordEngagement } from "../src/lib/course-access";
import { recomputeAssessment, processGradingJobs, reviewAffectedCredential } from "../src/lib/grading-workflow";
import { evaluateCourseCompletion } from "../src/lib/course-completion";
import { learnerCourseRecord, usageReport } from "../src/lib/delivery-reports";
import { normalizeDeliveryPolicy } from "../src/lib/delivery-policy";
import { notify } from "../src/lib/delivery-notifications";

process.env.DATA_DIR=mkdtempSync(join(tmpdir(),"ucc-commercial-tests-"));
process.env.DEMONSTRATION_FULL_FUNCTIONALITY="true";
const db=getRawDb();
const learner="learner@example.test",owner="owner@example.test";
await db.prepare("INSERT INTO users(email,full_name,role,status,identity_status) VALUES(?,?,'learner','active','verified')").bind(learner,"Test Learner").run();
await db.prepare("INSERT INTO users(email,full_name,role,status) VALUES(?,?,'facilitator','active')").bind(owner,"Test Owner").run();
let sequence=0;
async function course(override:Partial<ReturnType<typeof defaultCourseDesign>>={}) {
  const code=`TEST-${++sequence}`,design={...defaultCourseDesign(),...override};
  await db.prepare("INSERT INTO course_drafts(code,title,status,created_by_email,design_json,materials_json,certificate_preapproved) VALUES(?,?,'active',?,?,?,1)").bind(code,`Test course ${sequence}`,owner,JSON.stringify(design),JSON.stringify([{id:"one",title:"Lesson one",required:true}])).run();
  assert.equal(enrolWithSnapshot(learner,code).enrolled,true);return code;
}
async function submission(code:string,score:number,status="marked") {const result=await db.prepare("INSERT INTO assessment_submissions(user_email,course_code,attempt_number,status,final_score,passed,answers_json,marked_at) VALUES(?,?,1,?,?,?, '{}',CURRENT_TIMESTAMP)").bind(learner,code,status,score,score>=60?1:0).run();return Number(result.meta.last_row_id);}

test("correcting a passing grade downward removes the aggregate pass",async()=>{
  const code=await course(),id=await submission(code,80);
  db.transaction(native=>recomputeAssessment(native,learner,code));
  await db.prepare("UPDATE assessment_submissions SET final_score=40,passed=0 WHERE id=?").bind(id).run();
  db.transaction(native=>recomputeAssessment(native,learner,code));
  assert.deepEqual({...await db.prepare("SELECT score,passed FROM assessment_attempts WHERE user_email=? AND course_code=?").bind(learner,code).first()},{score:40,passed:0});
});
test("a separate valid passing attempt remains authoritative after another attempt is corrected",async()=>{
  const code=await course(),id=await submission(code,80);await db.prepare("INSERT INTO assessment_submissions(user_email,course_code,attempt_number,status,final_score,passed) VALUES(?,?,2,'marked',70,1)").bind(learner,code).run();
  await db.prepare("UPDATE assessment_submissions SET final_score=20,passed=0 WHERE id=?").bind(id).run();db.transaction(native=>recomputeAssessment(native,learner,code));
  const aggregate=await db.prepare("SELECT score,passed FROM assessment_attempts WHERE user_email=? AND course_code=?").bind(learner,code).first();assert.deepEqual({...aggregate},{score:70,passed:1});
});
test("saved enrolment pins the approved syllabus across later amendments",async()=>{
  const code=await course();await db.prepare("UPDATE course_drafts SET materials_json='[]',version_number=2 WHERE code=?").bind(code).run();
  assert.equal(JSON.parse((await enrolledCourse(learner,code))!.materials_json).length,1);
  assert.equal((await enrolledCourse(learner,code))!.version_number,1);
});
test("course team permissions distinguish teaching, marking, moderation and management",async()=>{
  const code=await course();for(const [email,role] of [["marker@example.test","marker"],["moderator@example.test","moderator"],["co@example.test","cofacilitator"]])await db.prepare("INSERT INTO course_team(course_code,user_email,team_role,assigned_by) VALUES(?,?,?,?)").bind(code,email,role,owner).run();
  assert.equal(await coursePermission({email:"marker@example.test",role:"facilitator"},code,"mark"),true);
  assert.equal(await coursePermission({email:"marker@example.test",role:"facilitator"},code,"teach"),false);
  assert.equal(await coursePermission({email:"moderator@example.test",role:"facilitator"},code,"moderate"),true);
  assert.equal(await coursePermission({email:"moderator@example.test",role:"facilitator"},code,"mark"),false);
  assert.equal(await coursePermission({email:"co@example.test",role:"facilitator"},code,"teach"),true);
  assert.equal(await coursePermission({email:"co@example.test",role:"facilitator"},code,"manage"),false);
  assert.equal(await coursePermission({email:"unassigned@example.test",role:"facilitator"},code),false);
});
test("attendance awards require attendance rather than an assessment pass",async()=>{
  const base=defaultCourseDesign(),code=await course({certificate:{...base.certificate,awardType:"attendance"},delivery:{...base.delivery,attendancePercent:100}});
  await db.prepare("INSERT INTO learning_progress(user_email,course_code,material_id,completed) VALUES(?,?,'one',1)").bind(learner,code).run();
  let evaluation=await evaluateCourseCompletion(learner,code);assert.equal(evaluation?.requirements.some(r=>r.type==="assessment"),false);assert.equal(evaluation?.complete,false);
  const session=await db.prepare("INSERT INTO delivery_sessions(course_code,title,starts_at,ends_at,meeting_url,created_by) VALUES(?,'Workshop','2026-01-01T10:00:00Z','2026-01-01T11:00:00Z','https://example.test',?)").bind(code,owner).run();
  await db.prepare("INSERT INTO session_attendance(session_id,user_email,attended,recorded_by) VALUES(?,?,1,?)").bind(session.meta.last_row_id,learner,owner).run();
  evaluation=await evaluateCourseCompletion(learner,code);assert.equal(evaluation?.complete,true);
});
test("future attendance cannot satisfy a participation award",async()=>{
  const base=defaultCourseDesign(),code=await course({certificate:{...base.certificate,awardType:"cpd_participation"},delivery:{...base.delivery,attendancePercent:100}});
  await db.prepare("INSERT INTO learning_progress(user_email,course_code,material_id,completed) VALUES(?,?,'one',1)").bind(learner,code).run();
  const session=await db.prepare("INSERT INTO delivery_sessions(course_code,title,starts_at,ends_at,meeting_url,created_by) VALUES(?,'Future workshop','2099-01-01T10:00:00Z','2099-01-01T11:00:00Z','https://example.test',?)").bind(code,owner).run();
  await db.prepare("INSERT INTO session_attendance(session_id,user_email,attended,recorded_by) VALUES(?,?,1,?)").bind(session.meta.last_row_id,learner,owner).run();
  assert.equal((await evaluateCourseCompletion(learner,code))?.complete,false);
});
test("a certificate becomes under review when corrected evidence no longer satisfies the award",async()=>{
  const code=await course();await db.prepare("INSERT INTO certificates(certificate_code,user_email,learner_name,course_code,course_title) VALUES(?,?,?,?,'Test course')").bind(`CERT-${code}`,learner,"Test Learner",code).run();
  await reviewAffectedCredential(learner,code,"Grade corrected to a fail.");await reviewAffectedCredential(learner,code,"Repeated correction.");
  assert.equal((await db.prepare("SELECT status FROM certificates WHERE certificate_code=?").bind(`CERT-${code}`).first<{status:string}>())?.status,"under_review");
  assert.equal((await db.prepare("SELECT COUNT(*) count FROM credential_reviews WHERE certificate_code=?").bind(`CERT-${code}`).first<{count:number}>())?.count,1);
});
test("a saved grading job finishes independently of the original request",async()=>{
  const code=await course(),id=await submission(code,0,"submitted");await db.prepare("UPDATE assessment_submissions SET final_score=NULL,answers_json=? WHERE id=?").bind(JSON.stringify({q:"yes"}),id).run();
  await db.prepare("INSERT INTO grading_jobs(submission_id,config_json) VALUES(?,?)").bind(id,JSON.stringify({questions:[{id:"q",type:"Multiple choice",correctAnswer:"yes",points:1,gradingMode:"rule"}],passMark:60})).run();
  assert.equal(await processGradingJobs(),1);const row=await db.prepare("SELECT status,final_score,passed FROM assessment_submissions WHERE id=?").bind(id).first();assert.deepEqual({...row},{status:"marked",final_score:100,passed:1});assert.equal(await processGradingJobs(),0);
});
test("assisted grading records a draft score without publishing a pass",async()=>{
  const code=await course(),id=await submission(code,0,"submitted");await db.prepare("UPDATE assessment_submissions SET final_score=NULL,answers_json=? WHERE id=?").bind(JSON.stringify({q:"yes"}),id).run();await db.prepare("INSERT INTO grading_jobs(submission_id,config_json) VALUES(?,?)").bind(id,JSON.stringify({markingMode:"assisted",questions:[{id:"q",type:"Multiple choice",correctAnswer:"yes",points:1,gradingMode:"rule"}]})).run();await processGradingJobs();assert.deepEqual({...await db.prepare("SELECT status,auto_score,final_score,passed FROM assessment_submissions WHERE id=?").bind(id).first()},{status:"awaiting_marking",auto_score:100,final_score:null,passed:0});
});
test("learning progress and resume records use the same saved lesson data",async()=>{
  const code=await course();await db.prepare("INSERT INTO learning_progress(user_email,course_code,material_id,completed,last_position) VALUES(?,?,'one',1,90)").bind(learner,code).run();const record=await learnerCourseRecord(learner,code);assert.equal(record?.progress,100);assert.equal(record?.lastPosition,90);assert.match(record!.resumeUrl,/\/one$/);
});
test("billable usage excludes staff and test learners and deduplicates users across courses",async()=>{
  const month=new Date().toISOString().slice(0,7);await db.prepare("INSERT INTO users(email,full_name,role,status,is_test_record) VALUES('demo@example.test','Demo','learner','active',1)").run();
  for(const email of [learner,owner,"demo@example.test"])for(const code of ["ONE","TWO"])await recordEngagement(email,code);
  const report=await usageReport(month);assert.equal(report.billableUsers,1);assert.equal(report.users[0].email,learner);assert.equal(report.users[0].courses,2);
});
test("notification deduplication preserves read state and avoids repeat messages",async()=>{
  await notify(learner,"same-key","session","Session","Reminder");await db.prepare("UPDATE delivery_notifications SET read_at=CURRENT_TIMESTAMP WHERE dedupe_key='same-key'").run();await notify(learner,"same-key","session","Session","Reminder");const row=await db.prepare("SELECT COUNT(*) count,MAX(read_at) read_at FROM delivery_notifications WHERE dedupe_key='same-key'").first<{count:number;read_at:string}>();assert.equal(row?.count,1);assert.ok(row?.read_at);
});
test("intake capacity and closure are enforced atomically",async()=>{
  const code=await course();await db.prepare("INSERT INTO course_runs(base_code,offering_code,name,enrolment_closes_at,capacity,created_by) VALUES(?,?,'Full intake','2099-01-01',1,?)").bind(code,code,owner).run();assert.match(enrolWithSnapshot("second@example.test",code).error||"",/capacity/);assert.equal(enrolWithSnapshot(learner,code).enrolled,true);
});
test("failed transactions roll back all writes",async()=>{
  assert.throws(()=>db.transaction(native=>{native.prepare("INSERT INTO course_cohorts(course_code,name) VALUES('ROLLBACK','Group')").run();throw new Error("stop");}));assert.equal(await db.prepare("SELECT id FROM course_cohorts WHERE course_code='ROLLBACK'").first(),null);
});
test("delivery policy validates dates and bounds without requiring institutional emails",()=>{
  const policy=normalizeDeliveryPolicy({markingMode:"human",attendancePercent:500,feedbackDays:0,assessmentDueAt:"invalid"});assert.equal(policy.markingMode,"human");assert.equal(policy.attendancePercent,100);assert.equal(policy.assessmentDueAt,"");assert.equal(policy.identityRequired,"before_award");
});
