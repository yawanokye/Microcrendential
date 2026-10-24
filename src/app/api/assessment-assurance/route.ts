import {requireActiveProfile} from "@/lib/accounts";
import {getRawDb} from "@/db/raw";
import {coursePermission,enrolledCourse,learningAccess,parseRecord} from "@/lib/course-access";
import {recordAudit} from "@/lib/audit";
import {rejectCrossSiteMutation} from "@/lib/request-security";
import {evaluateCourseCompletion,issueCertificateIfComplete} from "@/lib/course-completion";
import {reviewAffectedCredential} from "@/lib/grading-workflow";
import {normalizeCourseDesign} from "@/lib/course-design";
import {normalizeAssurancePolicy} from "@/lib/assessment-assurance-policy";
import {AssuranceError,assuranceReviewVersion,assuranceEnabled,assuranceRoster,consumeAssuranceSession,ensureAssuranceTables,ownedAssuranceSession,publicAssuranceSession,recordAssuranceEvent,startAssuranceSession,assuranceChallenge,reviewChecks,type AssuranceSession,type AssuranceReview} from "@/lib/assessment-assurance";
import {deleteStoredFile,putStoredFile} from "@/lib/render-storage";
import sharp from "sharp";
import {hasExecutableSignature} from "@/lib/file-security";
const errorResponse=(error:unknown)=>Response.json({error:error instanceof Error?error.message:"The assessment request failed."},{status:error instanceof AssuranceError?error.status:500,headers:{"cache-control":"no-store"}});
const headers={"cache-control":"private, no-store"};
async function learnerAccess(profile:Parameters<typeof learningAccess>[0],code:string){const access=await learningAccess(profile,code);if(!access.course)throw new AssuranceError("An active course enrolment and the required identity verification are needed.",403);return access.course;}
export async function GET(request:Request){const account=await requireActiveProfile();if(account.error||!account.profile)return account.error;try{
 ensureAssuranceTables();const p=new URL(request.url).searchParams,code=p.get("courseCode")||"",db=getRawDb();
 if(account.profile.role==="learner"){
  const course=await learnerAccess(account.profile,code),design=normalizeCourseDesign(parseRecord(course.design_json,{}));
  const row=p.get("id")?await ownedAssuranceSession(account.profile.email,p.get("id")!,request.headers.get("x-assessment-key")||""):null;
  if(row&&row.course_code!==code)throw new AssuranceError("This session belongs to another course.",403);
  return Response.json({learnerEmail:account.profile.email,enabled:assuranceEnabled(design.assurance),policy:design.assurance,roster:await assuranceRoster(account.profile.email,code),session:row?await publicAssuranceSession(row):null},{headers});
 }
 if(!code||!await coursePermission(account.profile,code,"view"))throw new AssuranceError("Select a course assigned to you.",403);
 const course=await db.prepare("SELECT design_json FROM course_drafts WHERE code=?").bind(code).first<{design_json:string}>(),offset=Math.max(0,Math.floor(Number(p.get("offset"))||0)),rows=await db.prepare("SELECT a.*,u.full_name learner_name,s.status assessment_status,s.final_score,s.passed assessment_passed FROM assessment_assurance_sessions a LEFT JOIN users u ON u.email=a.user_email LEFT JOIN assessment_submissions s ON s.id=a.submission_id WHERE a.course_code=? ORDER BY a.started_at DESC,a.id DESC LIMIT 101 OFFSET ?").bind(code,offset).all<AssuranceSession&{learner_name:string;assessment_status:string;final_score:number;assessment_passed:number}>();
 const sessions=[];for(const row of rows.results.slice(0,100)){const events=await db.prepare("SELECT id,kind,detail,created_at FROM assessment_assurance_events WHERE session_id=? ORDER BY id LIMIT 500").bind(row.id).all();const history=await db.prepare("SELECT actor_email,action,reason,created_at FROM assessment_assurance_history WHERE session_id=? ORDER BY id DESC LIMIT 50").bind(row.id).all();sessions.push({...await publicAssuranceSession(row),learnerEmail:row.user_email,learnerName:row.learner_name,assessmentStatus:row.assessment_status,finalScore:row.final_score,assessmentPassed:Boolean(row.assessment_passed),events:events.results,history:history.results,checks:reviewChecks(row)});}
 const roster=await db.prepare("SELECT r.*,u.full_name FROM assessment_assurance_roster r LEFT JOIN users u ON u.email=r.user_email WHERE r.course_code=? ORDER BY u.full_name,r.user_email").bind(code).all();
 const learners=await db.prepare("SELECT e.user_email,u.full_name FROM enrollments e JOIN users u ON u.email=e.user_email WHERE e.course_code=? AND e.status IN ('active','completed') ORDER BY u.full_name").bind(code).all();
 return Response.json({policy:normalizeCourseDesign(parseRecord(course?.design_json||"{}",{})).assurance,sessions,nextOffset:rows.results.length>100?offset+100:null,roster:roster.results,learners:learners.results,canReview:await coursePermission(account.profile,code,"mark"),canManage:await coursePermission(account.profile,code,"teach")},{headers});
 }catch(error){return errorResponse(error);}}
export async function POST(request:Request){const origin=rejectCrossSiteMutation(request);if(origin)return origin;const account=await requireActiveProfile();if(account.error||!account.profile)return account.error;
 try{
  ensureAssuranceTables();if(Number(request.headers.get("content-length"))>3*1024*1024)throw new AssuranceError("The submitted evidence is too large.",413);
  const reader=request.body?.getReader(),chunks:Uint8Array[]=[];let size=0;if(reader){try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>3*1024*1024){await reader.cancel();throw new AssuranceError("The submitted evidence is too large.",413);}chunks.push(value);}}finally{reader.releaseLock();}}
  const bounded=new Request(request.url,{method:"POST",headers:request.headers,body:Buffer.concat(chunks)}),multipart=request.headers.get("content-type")?.includes("multipart/form-data"),form=multipart?await bounded.formData():null,body=(form?Object.fromEntries([...form.entries()].filter(([,v])=>typeof v==="string")):await bounded.json()) as Record<string,unknown>;
  const action=String(body.action||""),code=String(body.courseCode||"").slice(0,80),id=String(body.id||""),key=request.headers.get("x-assessment-key")||"",db=getRawDb();
  if(account.profile.role!=="learner"){
   if(action==="roster"){
    if(!await coursePermission(account.profile,code,"teach"))throw new AssuranceError("Only the teaching team may manage employee registrations.",403);
    const email=String(body.email||"").trim().toLowerCase(),enrolled=await enrolledCourse(email,code);if(!enrolled)throw new AssuranceError("Select an employee already enrolled in this course.",400);
    const employeeId=String(body.employeeId||"").trim().slice(0,120),organisation=String(body.organisation||"").trim().slice(0,240),verified=body.verified===true,method=String(body.method||"").trim().slice(0,240),notes=String(body.notes||"").trim().slice(0,2000);
    if(verified&&(!method||notes.length<10))throw new AssuranceError("Record the identity-check method and evidence of at least ten characters.",400);
    const before=await assuranceRoster(email,code);await db.prepare("INSERT INTO assessment_assurance_roster(course_code,user_email,employee_id,organisation,identity_status,identity_method,identity_notes,reviewed_by,reviewed_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(course_code,user_email) DO UPDATE SET employee_id=excluded.employee_id,organisation=excluded.organisation,identity_status=excluded.identity_status,identity_method=excluded.identity_method,identity_notes=excluded.identity_notes,reviewed_by=excluded.reviewed_by,reviewed_at=excluded.reviewed_at").bind(code,email,employeeId,organisation,verified?"verified":"pending",method,notes,account.profile.email,new Date().toISOString()).run();
    await db.prepare("INSERT INTO assessment_assurance_history(course_code,user_email,actor_email,action,before_json,after_json,reason) VALUES(?,?,?,'identity',?,?,?)").bind(code,email,account.profile.email,JSON.stringify(before||{}),JSON.stringify({verified,method,employeeId,organisation}),notes||"Employee registration updated.").run();
    if(!verified)await reviewAffectedCredential(email,code,"The employee identity verification was changed to pending.");else await issueCertificateIfComplete(email,code);
    return Response.json({saved:true},{headers});
   }
   const row=await db.prepare("SELECT * FROM assessment_assurance_sessions WHERE id=?").bind(id).first<AssuranceSession>();if(!row||!await coursePermission(account.profile,row.course_code,"mark"))throw new AssuranceError("You are not assigned to review this assessment session.",403);
   const reason=String(body.feedback||body.reason||"").trim().slice(0,6000);if(reason.length<10)throw new AssuranceError("Record feedback or a reason of at least ten characters.",400);
   if(action==="reopen"){
    if(row.status!=="submitted")throw new AssuranceError("Only submitted verification evidence can be returned.");
    const before=parseRecord<AssuranceReview>(row.review_json,{}),next={meetingUrl:before.meetingUrl,meetingAt:before.meetingAt,meetingNotes:before.meetingNotes,cameraAlternative:before.cameraAlternative,feedback:reason};
    db.transaction(native=>{if(native.prepare("SELECT id FROM assessment_assurance_sessions WHERE user_email=? AND course_code=? AND status='active' AND id!=?").get(row.user_email,row.course_code,id))throw new AssuranceError("Another active session must be released first.");native.prepare("UPDATE assessment_assurance_sessions SET status='active',expires_at=NULL,last_checkpoint_at=NULL,review_json=? WHERE id=?").run(JSON.stringify(next),id);native.prepare("INSERT INTO assessment_assurance_history(session_id,course_code,user_email,actor_email,action,before_json,after_json,reason) VALUES(?,?,?,?,'reopened',?,?,?)").run(id,row.course_code,row.user_email,account.profile!.email,JSON.stringify(before),JSON.stringify(next),reason);});await reviewAffectedCredential(row.user_email,row.course_code,"Additional corporate verification was requested.");return Response.json({saved:true},{headers});
   }
   if(action==="extend"){
    if(!normalizeAssurancePolicy(parseRecord(row.policy_json,{})).timedAssessment||row.submission_id)throw new AssuranceError("This session does not have an active assessment time limit.");
    if(!["active","expired"].includes(row.status))throw new AssuranceError("Only active or expired sessions can receive an extension.");
    const expires=new Date(Math.max(Date.now(),row.expires_at?Date.parse(row.expires_at):0)+15*60000).toISOString();db.transaction(native=>{if(native.prepare("SELECT id FROM assessment_assurance_sessions WHERE user_email=? AND course_code=? AND status='active' AND id!=?").get(row.user_email,row.course_code,id))throw new AssuranceError("Another active session must be released first.");native.prepare("UPDATE assessment_assurance_sessions SET status='active',expires_at=? WHERE id=?").run(expires,id);native.prepare("INSERT INTO assessment_assurance_history(session_id,course_code,user_email,actor_email,action,before_json,after_json,reason) VALUES(?,?,?,?,'extended',?,?,?)").run(id,row.course_code,row.user_email,account.profile!.email,JSON.stringify({expiresAt:row.expires_at}),JSON.stringify({expiresAt:expires}),reason);});return Response.json({saved:true},{headers});
   }
   if(action==="release"){
    if(!["active","expired"].includes(row.status))throw new AssuranceError("Only active or expired sessions can be released.");
    if(row.submission_id)await db.prepare("UPDATE assessment_assurance_sessions SET status='active',token_hash='' WHERE id=? AND status IN ('active','expired')").bind(id).run();else await db.prepare("UPDATE assessment_assurance_sessions SET status='cancelled' WHERE id=? AND status IN ('active','expired')").bind(id).run();
    await db.prepare("INSERT INTO assessment_assurance_history(session_id,course_code,user_email,actor_email,action,before_json,after_json,reason) VALUES(?,?,?,?,'released',?,'{}',?)").bind(id,row.course_code,row.user_email,account.profile.email,JSON.stringify({status:row.status}),reason).run();return Response.json({saved:true},{headers});
   }
   if(!["review","meeting","camera_alternative"].includes(action))throw new AssuranceError("Unsupported review action.",400);
   if(String(body.expectedReviewVersion||"")!==assuranceReviewVersion(row.review_json))throw new AssuranceError("This session review changed. Reload the latest record before saving.");
   const before=parseRecord<AssuranceReview>(row.review_json,{}),policy=normalizeAssurancePolicy(parseRecord(row.policy_json,{}));let next:AssuranceReview;
   if(action==="camera_alternative"){
    const method=String(body.method||"").trim().slice(0,240);if(!policy.webcamCheckpoints||method.length<5||reason.length<20)throw new AssuranceError("Record the supervised alternative method and a reason of at least twenty characters.",400);
    next={...before,cameraAlternative:{method,reason,reviewer:account.profile.email,at:new Date().toISOString()}};
   }else if(action==="meeting"){
    const url=String(body.meetingUrl||"").trim(),at=String(body.meetingAt||"");if(url){const parsed=new URL(url);if(parsed.protocol!=="https:"||parsed.username||parsed.password)throw new AssuranceError("Use an HTTPS meeting link without credentials.",400);}if(at&&!Number.isFinite(Date.parse(at)))throw new AssuranceError("Choose a valid meeting time.",400);
    next={...before,meetingUrl:url.slice(0,3000),meetingAt:at?new Date(at).toISOString():"",meetingNotes:reason};
   }else{
    if(row.status!=="submitted")throw new AssuranceError("Review a submitted assessment or verification session.");
    const supplied=body.review&&typeof body.review==="object"?body.review as AssuranceReview:{};
    if(policy.webcamCheckpoints&&!before.cameraAlternative?.reviewer&&supplied.camera==="passed"&&!await db.prepare("SELECT id FROM assessment_assurance_evidence WHERE session_id=? AND kind='camera' AND deleted_at IS NULL").bind(id).first())throw new AssuranceError("No retained webcam evidence is available to approve. Record a resubmission decision.");
    const statuses=(v:unknown)=>v==="passed"||v==="resubmit"?v:undefined;
    const practical=Number(supplied.practicalMark);if(policy.practicalTask&&(!Number.isFinite(practical)||practical<0||practical>100))throw new AssuranceError("Enter a workplace-task mark from 0 to 100.",400);
    const competencyMarks:Record<string,number>={};if(policy.competencyChecks)for(const c of policy.competencies){const mark=Number(supplied.competencies?.[c.outcomeId]);if(!Number.isFinite(mark)||mark<0||mark>100)throw new AssuranceError("Record a mark from 0 to 100 for every required competency.",400);competencyMarks[c.outcomeId]=mark;}
    next={...before,camera:policy.webcamCheckpoints?statuses(supplied.camera):undefined,oral:policy.oralCheck?statuses(supplied.oral):undefined,overall:policy.humanReview?statuses(supplied.overall):undefined,practicalMark:policy.practicalTask?practical:undefined,competencies:competencyMarks,feedback:reason,reviewer:account.profile.email,reviewedAt:new Date().toISOString()};
   }
   db.transaction(native=>{const saved=native.prepare("UPDATE assessment_assurance_sessions SET review_json=? WHERE id=? AND review_json=?").run(JSON.stringify(next),id,row.review_json);if(!saved.changes)throw new AssuranceError("This review changed in another session. Reload before saving.");native.prepare("INSERT INTO assessment_assurance_history(session_id,course_code,user_email,actor_email,action,before_json,after_json,reason) VALUES(?,?,?,?,?,?,?,?)").run(id,row.course_code,row.user_email,account.profile!.email,action,JSON.stringify(before),JSON.stringify(next),reason);});
   await reviewAffectedCredential(row.user_email,row.course_code,"Corporate assessment review was changed.");await issueCertificateIfComplete(row.user_email,row.course_code);await recordAudit(account.profile.email,"assessment.assurance_review",{id,action});return Response.json({saved:true},{headers});
  }
  const course=await learnerAccess(account.profile,code);
  if(action==="start"){
   const evaluation=await evaluateCourseCompletion(account.profile.email,code);if(evaluation?.requirements.some(r=>["content","learning_activity","virtual_lab","colab"].includes(r.type)&&!r.complete))throw new AssuranceError("Complete the required learning before starting the assessment.");
   const due=normalizeCourseDesign(parseRecord(course.design_json,{})).delivery.assessmentDueAt;if(due&&Date.parse(due)<Date.now())throw new AssuranceError("The assessment deadline has passed.");
   return Response.json({session:await publicAssuranceSession(await startAssuranceSession(account.profile.email,code,key,course))},{status:201,headers});
  }
  const row=await ownedAssuranceSession(account.profile.email,id,key,true);if(row.course_code!==code)throw new AssuranceError("This session belongs to another course.",403);const policy=normalizeAssurancePolicy(parseRecord(row.policy_json,{}));
  if(action==="challenge")return Response.json({challenge:await assuranceChallenge(row)},{headers});
  if(action==="event"){await recordAssuranceEvent(row,String(body.kind||""),String(body.detail||""));return Response.json({saved:true},{headers});}
  if(action==="answers"){
   const answers=body.answers;if(!answers||typeof answers!=="object"||Array.isArray(answers)||JSON.stringify(answers).length>200000)throw new AssuranceError("Supply valid assessment answers.",400);
   const ids=new Set(parseRecord<{id:string}[]>(row.questions_json,[]).map(q=>q.id)),safe=Object.fromEntries(Object.entries(answers).filter(([questionId])=>ids.has(questionId)));await db.prepare("UPDATE assessment_assurance_sessions SET answers_json=? WHERE id=? AND status='active'").bind(JSON.stringify(safe),id).run();return Response.json({saved:true},{headers});
  }
  if(action==="camera"){
   if(!policy.webcamCheckpoints)throw new AssuranceError("Camera checkpoints are switched off.");
   const challenge=parseRecord<{id:string;prompt:string;expiresAt:string;issuedAt:string}|null>(row.challenge_json||"null",null);if(!challenge||challenge.id!==body.challengeId||Date.parse(challenge.expiresAt)<=Date.now())throw new AssuranceError("Request a fresh webcam checkpoint.");
   const files=[form?.get("first"),form?.get("second")];if(files.some(f=>!(f instanceof File)||f.size>650000))throw new AssuranceError("Supply two camera images of at most 650 KB each.",400);
   const stored:string[]=[];try{for(const file of files as File[]){const cleaned=await sharp(Buffer.from(await file.arrayBuffer()),{limitInputPixels:3000000}).resize({width:960,height:720,fit:"inside",withoutEnlargement:true}).jpeg({quality:72}).toBuffer();stored.push(await putStoredFile("assessment-assurance",new File([new Uint8Array(cleaned)],"checkpoint.jpg",{type:"image/jpeg"}),{contentType:"image/jpeg",originalName:"checkpoint.jpg",ownerEmail:account.profile.email,evidenceKind:"assessment-assurance-camera"}));}
    db.transaction(native=>{const current=native.prepare("SELECT challenge_json,status,last_checkpoint_at,started_at FROM assessment_assurance_sessions WHERE id=?").get(id) as {challenge_json:string;status:string;last_checkpoint_at:string|null;started_at:string};if(current.status!=="active"||current.challenge_json!==row.challenge_json)throw new AssuranceError("This checkpoint was already used. Request another.");const now=new Date().toISOString(),expires=new Date(Date.now()+policy.retentionDays*86400000).toISOString();const gap=Date.now()-Date.parse(current.last_checkpoint_at||current.started_at);if(gap>(policy.checkpointMinutes*60+60)*1000)native.prepare("INSERT INTO assessment_assurance_events(session_id,kind,detail,created_at) VALUES(?,'checkpoint_gap',?,?)").run(id,`Approximately ${Math.floor(gap/60000)} minutes since the previous camera checkpoint. Review the circumstances with the employee.`,now);for(const fileKey of stored)native.prepare("INSERT INTO assessment_assurance_evidence(session_id,kind,file_key,challenge_id,prompt,created_at,expires_at) VALUES(?,'camera',?,?,?,?,?)").run(id,fileKey,challenge.id,challenge.prompt,now,expires);native.prepare("UPDATE assessment_assurance_sessions SET last_checkpoint_at=?,challenge_json=NULL WHERE id=?").run(now,id);});
   }catch(error){for(const fileKey of stored)await deleteStoredFile(fileKey).catch(()=>{});throw error;}
   return Response.json({saved:true,message:"Camera evidence saved for facilitator review."},{headers});
  }
  if(action==="practical"){
   if(!policy.practicalTask)throw new AssuranceError("The workplace task is switched off.");const text=String(body.text||"").trim().slice(0,20000),file=form?.get("file");if(!text&&!(file instanceof File&&file.size))throw new AssuranceError("Enter your workplace response or attach evidence.",400);
   if(file instanceof File&&file.size){if(file.size>2*1024*1024)throw new AssuranceError("Workplace evidence is limited to 2 MB.",413);if(!/\.(pdf|txt|png|jpe?g|webp|docx)$/i.test(file.name))throw new AssuranceError("Use PDF, DOCX, TXT or an image for workplace evidence.",400);if(await hasExecutableSignature(file))throw new AssuranceError("Executable files cannot be submitted as workplace evidence.",400);const contentType=/\.pdf$/i.test(file.name)?"application/pdf":/\.txt$/i.test(file.name)?"text/plain":"application/octet-stream",fileKey=await putStoredFile("assessment-assurance",file,{contentType,originalName:file.name,ownerEmail:account.profile.email,evidenceKind:"assessment-assurance-practical"});await db.prepare("INSERT INTO assessment_assurance_evidence(session_id,kind,file_key,prompt,created_at,expires_at) VALUES(?,'practical',?,'Workplace evidence',?,?)").bind(id,fileKey,new Date().toISOString(),new Date(Date.now()+policy.retentionDays*86400000).toISOString()).run();}
   await db.prepare("UPDATE assessment_assurance_sessions SET practical_text=? WHERE id=? AND status='active'").bind(text,id).run();return Response.json({saved:true},{headers});
  }
  if(action==="finish"&&(row.verification_only||row.submission_id)){db.transaction(native=>{consumeAssuranceSession(native,account.profile!.email,code,id,key,row.submission_id||0);});await issueCertificateIfComplete(account.profile.email,code);return Response.json({saved:true},{headers});}
  throw new AssuranceError("Unsupported assessment action.",400);
 }catch(error){return errorResponse(error);}}
