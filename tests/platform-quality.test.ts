import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import type { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { getRawDb } from "../src/db/raw";
import { defaultCourseDesign,evaluateCourseQuality } from "../src/lib/course-design";
import { enrolWithSnapshot } from "../src/lib/course-access";
import { evaluateCourseCompletion, issueCertificateIfComplete } from "../src/lib/course-completion";
import { createCheckoutOrder, settlePaymentOrder } from "../src/lib/payments";
import { publicCatalogue } from "../src/lib/public-catalogue";
import { releasedProgrammeAttempts } from "../src/lib/programme-results";
import { checkoutAllowedInCurrentMode, officialCredentialsEnabled } from "../src/lib/platform-mode";
import { previousRequiredLessons } from "../src/lib/delivery-policy";
import { libraryMutation,searchLibrary } from "../src/lib/open-library";
import { issueBroaderCredentialsIfEligible } from "../src/lib/credential-stack";

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "ucc-quality-tests-"));
process.env.SQLITE_PATH = join(process.env.DATA_DIR, "platform.sqlite");
process.env.DEMONSTRATION_FULL_FUNCTIONALITY = "true";
process.env.DEMONSTRATION_ALLOW_OFFICIAL_CREDENTIALS = "true";
const db = getRawDb(), owner = "owner@example.test";
await db.prepare("INSERT INTO users(email,full_name,role,status) VALUES(?,'Owner','facilitator','active')").bind(owner).run();
for (const name of ["first","second","third"]) await db.prepare("INSERT INTO users(email,full_name,role,status,identity_status) VALUES(?,?,'learner','active','verified')").bind(`${name}@example.test`, name).run();

async function addCourse(code:string, award:"attendance"|"cpd_participation"|"microcredential_achievement" = "microcredential_achievement", capacity = 0) {
  const design=defaultCourseDesign(); design.certificate.awardType=award; design.delivery.attendancePercent=100;
  await db.prepare("INSERT INTO course_drafts(code,title,status,created_by_email,design_json,materials_json,certificate_preapproved) VALUES(?,?,'active',?,?,?,1)").bind(code,code,owner,JSON.stringify(design),JSON.stringify([{id:"lesson",title:"Lesson",kind:"Read"}])).run();
  if(capacity)await db.prepare("INSERT INTO course_runs(base_code,offering_code,name,enrolment_closes_at,capacity,created_by) VALUES(?,?,'Intake','2099-01-01',?,?)").bind(code,code,capacity,owner).run();
}
const checkout=(reference:string,email:string,courseCode:string)=>createCheckoutOrder({reference,email,courseCode,purpose:"enrollment",amount:10000,kind:"course",billingSnapshot:"{}"});

test("attendance and CPD participation awards require verified identity and an authorised UCC signature",async()=>{
  const email="first@example.test";
  for (const award of ["attendance","cpd_participation"] as const) {
    const code=`CERT-${award}`; await addCourse(code,award);
    await db.prepare("UPDATE users SET identity_status='not_submitted' WHERE email=?").bind(email).run();
    assert.equal(enrolWithSnapshot(email,code).enrolled,true);
    await db.prepare("INSERT INTO learning_progress(user_email,course_code,material_id,completed) VALUES(?,?,'lesson',1)").bind(email,code).run();
    const session=await db.prepare("INSERT INTO delivery_sessions(course_code,title,starts_at,ends_at,meeting_url,created_by) VALUES(?,'Workshop','2026-01-01','2026-01-02','https://example.test',?)").bind(code,owner).run();
    await db.prepare("INSERT INTO session_attendance(session_id,user_email,attended,recorded_by) VALUES(?,?,1,?)").bind(session.meta.last_row_id,email,owner).run();
    const incomplete=await evaluateCourseCompletion(email,code);
    assert.equal(incomplete?.complete,false); assert.equal(incomplete?.requirements.find(r=>r.type==="identity")?.complete,false);
    assert.equal((await issueCertificateIfComplete(email,code)).certificate,null);
    await db.prepare("UPDATE users SET identity_status='verified' WHERE email=?").bind(email).run();
    const unsigned=await issueCertificateIfComplete(email,code);
    assert.equal(unsigned.evaluation?.complete,true); assert.equal(unsigned.certificate,null);
    assert.match("issuanceProblem" in unsigned ? unsigned.issuanceProblem || "" : "",/signatory/i);
    await db.prepare("INSERT INTO certificate_signatures(signature_key,role,signatory_name,signatory_title,file_key,file_name,mime_type,uploaded_by_email) VALUES('provost','provost','Authorised signatory','Provost','test/signature','signature.png','image/png',?)").bind(owner).run();
    assert.ok((await issueCertificateIfComplete(email,code)).certificate);
    await db.prepare("DELETE FROM certificate_signatures WHERE signature_key='provost'").run();
  }
});

test("stacked awards also require current verified identity and the UCC signature",async()=>{
  const email="third@example.test";await addCourse("STACK-C1");await addCourse("STACK-C2");
  const design=defaultCourseDesign();design.credentialStructure="broader";design.componentCredentialCodes=["STACK-C1","STACK-C2"];
  await db.prepare("INSERT INTO course_drafts(code,title,status,created_by_email,design_json,certificate_preapproved) VALUES('STACK-BROAD','Broader award','active',?,?,1)").bind(owner,JSON.stringify(design)).run();
  for(const code of ["STACK-C1","STACK-C2"])await db.prepare("INSERT INTO certificates(certificate_code,user_email,learner_name,course_code,course_title) VALUES(?,?,?, ?,?)").bind(`UCC-${code}`,email,"Learner",code,code).run();
  await db.prepare("UPDATE users SET identity_status='not_submitted' WHERE email=?").bind(email).run();assert.deepEqual(await issueBroaderCredentialsIfEligible(email),[]);
  await db.prepare("UPDATE users SET identity_status='verified' WHERE email=?").bind(email).run();assert.deepEqual(await issueBroaderCredentialsIfEligible(email),[]);
  await db.prepare("INSERT INTO certificate_signatures(signature_key,role,signatory_name,signatory_title,file_key,file_name,mime_type,uploaded_by_email) VALUES('provost','provost','Authorised signatory','Provost','test/signature','signature.png','image/png',?)").bind(owner).run();
  assert.equal((await issueBroaderCredentialsIfEligible(email)).length,1);await db.prepare("DELETE FROM certificate_signatures WHERE signature_key='provost'").run();
});

test("a required activity cleared during completion cannot produce a certificate or completed enrolment",async()=>{
  const email="second@example.test",code="ACTIVITY-ISSUANCE-RACE";
  await addCourse(code);
  const activity={id:"external",kind:"inline",materialId:"lesson",title:"External activity",required:true};
  await db.prepare("UPDATE course_drafts SET activities_json=? WHERE code=?").bind(JSON.stringify([activity]),code).run();
  assert.equal(enrolWithSnapshot(email,code).enrolled,true);
  await db.prepare("INSERT INTO learning_progress(user_email,course_code,material_id,completed) VALUES(?,?,'lesson',1)").bind(email,code).run();
  await db.prepare("INSERT INTO assessment_attempts(user_email,course_code,score,passed) VALUES(?,?,80,1)").bind(email,code).run();
  await db.prepare("INSERT INTO material_activity_submissions(user_email,course_code,material_id,activity_id,mark,passed,feedback) VALUES(?,?,'lesson','external',80,1,'Evidence reviewed')").bind(email,code).run();
  await db.prepare("INSERT INTO certificate_signatures(signature_key,role,signatory_name,signatory_title,file_key,file_name,mime_type,uploaded_by_email) VALUES('provost','provost','Authorised signatory','Provost','test/signature','signature.png','image/png',?)").bind(owner).run();
  const original=db.transaction.bind(db);let cleared=false;
  db.transaction=<T,>(operation:(native:DatabaseSync)=>T):T=>{
    if(!cleared){cleared=true;db.read(native=>native.prepare("UPDATE material_activity_submissions SET passed=0,mark=NULL WHERE user_email=? AND course_code=? AND activity_id='external'").run(email,code));}
    return original(operation);
  };
  try{
    const result=await issueCertificateIfComplete(email,code);
    assert.equal(cleared,true);assert.equal(result.certificate,null);
    assert.equal((await db.prepare("SELECT status FROM enrollments WHERE user_email=? AND course_code=?").bind(email,code).first<{status:string}>())?.status,"active");
  }finally{db.transaction=original;}
  await db.prepare("UPDATE material_activity_submissions SET passed=1,mark=80 WHERE user_email=? AND course_code=? AND activity_id='external'").bind(email,code).run();
  let transactions=0;
  db.transaction=<T,>(operation:(native:DatabaseSync)=>T):T=>{
    if(++transactions===2)db.read(native=>native.prepare("UPDATE material_activity_submissions SET passed=0,mark=NULL WHERE user_email=? AND course_code=? AND activity_id='external'").run(email,code));
    return original(operation);
  };
  try{
    const result=await issueCertificateIfComplete(email,code);
    assert.equal(transactions,2);assert.equal(result.certificate,null);
    assert.equal((await db.prepare("SELECT status FROM enrollments WHERE user_email=? AND course_code=?").bind(email,code).first<{status:string}>())?.status,"active");
  }finally{db.transaction=original;}
  await db.prepare("UPDATE material_activity_submissions SET passed=1,mark=80 WHERE user_email=? AND course_code=? AND activity_id='external'").bind(email,code).run();
  assert.ok((await issueCertificateIfComplete(email,code)).certificate);
  await db.prepare("DELETE FROM certificate_signatures WHERE signature_key='provost'").run();
});

test("a checkout seat is held atomically and settlement is idempotent",async()=>{
  const code="HOLD-ONE", first="first@example.test", second="second@example.test";await addCourse(code,undefined,1);
  assert.ok(checkout("HOLD-REF",first,code).expiresAt);
  assert.throws(()=>checkout("HOLD-OTHER",second,code),/capacity/);
  assert.match(enrolWithSnapshot(second,code).error||"",/capacity/);
  const paid=await settlePaymentOrder("HOLD-REF",{test:true});assert.equal("fulfilled" in paid && paid.fulfilled,true);
  assert.equal((await settlePaymentOrder("HOLD-REF",{})).fulfilled,true);
  assert.equal((await db.prepare("SELECT COUNT(*) n FROM enrollments WHERE user_email=? AND course_code=?").bind(first,code).first<{n:number}>())?.n,1);
});

test("simultaneous checkout requests cannot reserve the same final seat",async()=>{
  const code="RACE-ONE";await addCourse(code,undefined,1);
  const script=`import {createCheckoutOrder} from './src/lib/payments';try{createCheckoutOrder({reference:process.argv[1],email:process.argv[2],courseCode:'RACE-ONE',purpose:'enrollment',amount:10000,kind:'course',billingSnapshot:'{}'});process.stdout.write('reserved')}catch{process.stdout.write('rejected')}`;
  const attempt=(reference:string,email:string)=>new Promise<string>((resolve,reject)=>{const child=spawn(process.execPath,["--import","tsx","--eval",script,reference,email],{env:process.env,stdio:["ignore","pipe","pipe"]});let out="",err="";child.stdout.on("data",chunk=>out+=chunk);child.stderr.on("data",chunk=>err+=chunk);child.on("error",reject);child.on("exit",code=>code===0?resolve(out):reject(new Error(err)));});
  const results=await Promise.all([attempt("RACE-A","first@example.test"),attempt("RACE-B","second@example.test")]);
  assert.deepEqual(results.sort(),["rejected","reserved"]);
  assert.equal((await db.prepare("SELECT COUNT(*) n FROM payment_seat_reservations WHERE course_code=? AND released_at IS NULL").bind(code).first<{n:number}>())?.n,1);
});

test("late payment remains pending when full and can be fulfilled once a place opens",async()=>{
  const code="LATE-ONE", first="first@example.test", second="second@example.test";await addCourse(code,undefined,1);
  checkout("LATE-REF",first,code);
  await db.prepare("UPDATE payment_seat_reservations SET expires_at='2000-01-01' WHERE reference='LATE-REF'").run();
  assert.equal(enrolWithSnapshot(second,code).enrolled,true);
  const pending=await settlePaymentOrder("LATE-REF",{test:true});assert.equal("fulfilled" in pending && pending.fulfilled,false);
  const order=await db.prepare("SELECT status,fulfilment_status FROM payment_orders WHERE reference='LATE-REF'").first<{status:string;fulfilment_status:string}>();assert.deepEqual({...order},{status:"paid",fulfilment_status:"pending"});
  await db.prepare("UPDATE enrollments SET status='withdrawn' WHERE user_email=? AND course_code=?").bind(second,code).run();
  const completed=await settlePaymentOrder("LATE-REF",{});assert.equal("fulfilled" in completed && completed.fulfilled,true);
  assert.equal((await db.prepare("SELECT status FROM enrollments WHERE user_email=? AND course_code=?").bind(first,code).first<{status:string}>())?.status,"active");
});

test("an open refund stops a pending enrolment being fulfilled",async()=>{
  const code="REFUND-ONE",first="first@example.test",second="second@example.test";await addCourse(code,undefined,1);checkout("REFUND-REF",first,code);
  await db.prepare("UPDATE payment_seat_reservations SET expires_at='2000-01-01' WHERE reference='REFUND-REF'").run();assert.equal(enrolWithSnapshot(second,code).enrolled,true);
  await settlePaymentOrder("REFUND-REF",{});await db.prepare("INSERT INTO refund_requests(payment_reference,user_email,reason) VALUES('REFUND-REF',?,'Please refund this payment')").bind(first).run();
  await db.prepare("UPDATE enrollments SET status='withdrawn' WHERE user_email=? AND course_code=?").bind(second,code).run();
  const result=await settlePaymentOrder("REFUND-REF",{});assert.equal("fulfilled" in result && result.fulfilled,false);
  assert.equal((await db.prepare("SELECT fulfilment_status FROM payment_orders WHERE reference='REFUND-REF'").first<{fulfilment_status:string}>())?.fulfilment_status,"refund_pending");
  assert.equal(await db.prepare("SELECT id FROM enrollments WHERE user_email=? AND course_code=?").bind(first,code).first(),null);
});

test("public search paginates beyond 100 offerings without exposing private courses",()=>{
  const design=JSON.stringify(defaultCourseDesign());
  db.transaction(native=>{
    const insert=native.prepare("INSERT INTO course_drafts(code,title,description,status,created_by_email,design_json) VALUES(?,?,'Search fixture','active',?,?)");
    for(let n=0;n<105;n++)insert.run(`PAGE-${n}`,`Pagination marker ${n}`,owner,design);
    native.prepare("INSERT INTO offering_access(offering_kind,offering_code,visibility,updated_by) VALUES('course','PAGE-0','private',?)").run(owner);
  });
  const first=publicCatalogue(new URLSearchParams({q:"pagination marker",limit:"25",page:"1"}));
  const fifth=publicCatalogue(new URLSearchParams({q:"pagination marker",limit:"25",page:"5"}));
  assert.equal(first.total,104);assert.equal(first.courses.length,25);assert.equal(first.hasMore,true);assert.equal(fifth.courses.length,4);
  const privateResult=publicCatalogue(new URLSearchParams({offering:"course:PAGE-0"}));assert.equal(privateResult.total,0);
  const older=publicCatalogue(new URLSearchParams({offering:"course:PAGE-1"}));assert.equal(older.total,1);
});

test("academic history includes every released attempt without exposing another learner's result",async()=>{
  await addCourse("ATTEMPT-HISTORY");
  for(const [email,attempt,mark,passed] of [["first@example.test",1,40,0],["first@example.test",2,75,1],["second@example.test",1,90,1]] as const)await db.prepare("INSERT INTO assessment_submissions(user_email,course_code,attempt_number,status,final_score,passed,marked_at) VALUES(?,'ATTEMPT-HISTORY',?,'marked',?,?,CURRENT_TIMESTAMP)").bind(email,attempt,mark,passed).run();
  const attempts=db.read(native=>releasedProgrammeAttempts(native,"first@example.test",["ATTEMPT-HISTORY"]));
  assert.deepEqual(attempts.map(a=>[a.attemptNumber,a.mark,a.passed]),[[1,40,false],[2,75,true]]);
});

test("acceptance checkout and official certificates need separate explicit authorisation",async()=>{
  const previous=process.env.DEMONSTRATION_ALLOW_OFFICIAL_CREDENTIALS,previousPayments=process.env.DEMONSTRATION_ALLOW_PAYMENTS,previousMode=process.env.PLATFORM_MODE;
  try {delete process.env.DEMONSTRATION_ALLOW_OFFICIAL_CREDENTIALS;delete process.env.DEMONSTRATION_ALLOW_PAYMENTS;assert.equal(await officialCredentialsEnabled(),false);assert.equal(await checkoutAllowedInCurrentMode(),false);process.env.DEMONSTRATION_ALLOW_OFFICIAL_CREDENTIALS="true";assert.equal(await officialCredentialsEnabled(),true);assert.equal(await checkoutAllowedInCurrentMode(),false);process.env.DEMONSTRATION_ALLOW_PAYMENTS="true";assert.equal(await checkoutAllowedInCurrentMode(),true);process.env.PLATFORM_MODE="official_pilot";assert.equal(await officialCredentialsEnabled(),false);assert.equal(await checkoutAllowedInCurrentMode(),false);}
  finally {if(previous===undefined)delete process.env.DEMONSTRATION_ALLOW_OFFICIAL_CREDENTIALS;else process.env.DEMONSTRATION_ALLOW_OFFICIAL_CREDENTIALS=previous;if(previousPayments===undefined)delete process.env.DEMONSTRATION_ALLOW_PAYMENTS;else process.env.DEMONSTRATION_ALLOW_PAYMENTS=previousPayments;if(previousMode===undefined)delete process.env.PLATFORM_MODE;else process.env.PLATFORM_MODE=previousMode;}
});

test("optional lesson sequence ignores optional earlier blocks",()=>{
  assert.deepEqual(previousRequiredLessons([{id:"one"},{id:"optional",required:false},{id:"three"}],"three"),["one"]);
});

test("video quality requires an actual accessibility review as well as a transcript",()=>{
  const design=defaultCourseDesign(),video={id:"v",title:"Video",source:"test",kind:"Watch" as const,transcript:"Transcript",transcriptPublished:true,accessibilityChecked:false};
  const check=(reviewed:boolean)=>evaluateCourseQuality({design,materials:[{...video,accessibilityChecked:reviewed}],questionCount:0}).checks.find(c=>c.id==="accessible")?.passed;
  assert.equal(check(false),false);assert.equal(check(true),true);
});

test("library account quotas are adjustable and result pages use separate cached requests",async()=>{
  const admin={email:"admin@example.test",role:"admin" as const},learner={email:"third@example.test",role:"learner" as const};
  await libraryMutation(admin,{action:"settings",enabled:true,dailyLimit:80,userDailyLimit:4});
  const original=globalThis.fetch;let calls=0;
  globalThis.fetch=async(input)=>{calls++;const url=new URL(String(input)),page=Number(url.searchParams.get("page")||1);return Response.json({results:Array.from({length:12},(_,i)=>({id:`https://openalex.org/${page}-${i}`,display_name:`Book ${page}-${i}`,open_access:{is_oa:true,oa_url:`https://example.org/${page}-${i}`}}))});};
  try{const first=await searchLibrary(learner,"finance topic","","article",1),second=await searchLibrary(learner,"finance topic","","article",2);assert.equal(first.hasMore,true);assert.equal(second.page,2);assert.notEqual(first.resources[0].id,second.resources[0].id);await searchLibrary(learner,"finance topic","","article",1);assert.equal(calls,2);}
  finally{globalThis.fetch=original;}
});
