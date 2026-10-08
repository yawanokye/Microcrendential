import { getRawDb } from "@/db/raw";
import { requireActiveProfile } from "@/lib/accounts";
import { issueCertificateIfComplete } from "@/lib/course-completion";
import { after } from "next/server";
import { queueEvidence, processEvidenceJobs } from "@/lib/evidence-workflow";
import { learningAccess, recordEngagement } from "@/lib/course-access";
import { getVirtualPractical, virtualPracticals } from "@/lib/virtual-labs";
import { putStoredFile } from "@/lib/render-storage";
import { rejectCrossSiteMutation } from "@/lib/request-security";

type VirtualCourseActivity = {
  id?: string; title?: string; instructions?: string; rubric?: string; maxMark?: number; passMark?: number; attemptsAllowed?: number; gradingMode?: string; practicalId?: string; dueAt?: string;
};

type SubmissionRow = {
  id: number; practical_id: string; discipline: string; practical_title: string; learner_email: string; learner_name: string | null;
  attempt_number: number; observations_json: string; answers_json: string; report: string; evidence_file_name: string | null;
  status: string; mark: number | null; passed: number; feedback: string; competency_note: string; submitted_at: string; assessed_at: string | null;
};

function parseJson<T>(value: string, fallback: T) { try { return JSON.parse(value) as T; } catch { return fallback; } }
function present(row: SubmissionRow) {
  return {
    id: row.id, practicalId: row.practical_id, discipline: row.discipline, practicalTitle: row.practical_title,
    learnerEmail: row.learner_email, learnerName: row.learner_name ?? row.learner_email, attemptNumber: row.attempt_number,
    observations: parseJson<unknown[]>(row.observations_json, []), answers: parseJson<Record<string, unknown>>(row.answers_json, {}),
    report: row.report, evidenceFileName: row.evidence_file_name, status: row.status, mark: row.mark, passed: Boolean(row.passed),
    feedback: row.feedback, competencyNote: row.competency_note, submittedAt: row.submitted_at, assessedAt: row.assessed_at,
  };
}

export async function GET() {
  const account = await requireActiveProfile();
  if (account.error || !account.profile) return account.error;
  const db = getRawDb();
  const base = `SELECT s.*, u.full_name AS learner_name FROM virtual_lab_submissions s LEFT JOIN users u ON u.email = s.learner_email`;
  let rows;
  if (account.profile.role === "learner") {
    rows = await db.prepare(`${base} WHERE s.learner_email = ? ORDER BY s.submitted_at DESC`).bind(account.profile.email).all<SubmissionRow>();
  } else if (account.profile.role === "facilitator") {
    rows = await db.prepare(`${base}
      WHERE EXISTS (
        SELECT 1 FROM course_drafts c
        WHERE c.created_by_email = ? AND c.status = 'active'
          AND instr(c.activities_json, '"practicalId":"' || s.practical_id || '"') > 0
      )
      ORDER BY CASE s.status WHEN 'submitted' THEN 0 WHEN 'resubmit' THEN 1 ELSE 2 END, s.submitted_at DESC
    `).bind(account.profile.email).all<SubmissionRow>();
  } else {
    rows = await db.prepare(`${base} ORDER BY CASE s.status WHEN 'submitted' THEN 0 WHEN 'resubmit' THEN 1 ELSE 2 END, s.submitted_at DESC`).all<SubmissionRow>();
  }
  return Response.json({ practicals: virtualPracticals, submissions: rows.results.map(present) });
}

export async function POST(request: Request) {
  const securityError = rejectCrossSiteMutation(request); if (securityError) return securityError;
  const account = await requireActiveProfile(["learner"]);
  if (account.error || !account.profile) return account.error;
  const form = await request.formData();
  const practicalId = String(form.get("practicalId") ?? "").trim();
  const practical = getVirtualPractical(practicalId);
  if (!practical) return Response.json({ error: "Choose a recognised virtual practical." }, { status: 400 });
  const report = String(form.get("report") ?? "").trim();
  if (report.length < 40) return Response.json({ error: "Provide a practical report of at least 40 characters." }, { status: 400 });
  const observationsValue = String(form.get("observations") ?? "[]");
  const answersValue = String(form.get("answers") ?? "{}");
  let observations: unknown[]; let answers: Record<string, unknown>;
  try { observations = JSON.parse(observationsValue) as unknown[]; answers = JSON.parse(answersValue) as Record<string, unknown>; if (!Array.isArray(observations) || !answers || typeof answers !== "object") throw new Error(); }
  catch { return Response.json({ error: "The practical observations could not be read." }, { status: 400 }); }
  if (observations.length < 1) return Response.json({ error: "Record at least one trial or observation before submitting." }, { status: 400 });
  const db = getRawDb();
  const enrolledCourses=await db.prepare(`SELECT c.code,COALESCE(json_extract(e.course_snapshot_json,'$.activities_json'),c.activities_json) activities_json FROM course_drafts c JOIN enrollments e ON e.course_code=c.code AND e.user_email=? AND e.status IN ('active','completed') WHERE c.status='active' AND instr(COALESCE(json_extract(e.course_snapshot_json,'$.activities_json'),c.activities_json),'"practicalId":"' || ? || '"')>0`).bind(account.profile.email,practical.id).all<{code:string;activities_json:string}>();
  let activity: VirtualCourseActivity | null = null; let courseCode="";
  const contextCode=String(form.get("courseCode")||"");
  for(const course of enrolledCourses.results.filter(c=>!contextCode||c.code===contextCode)){ try{ const items=JSON.parse(course.activities_json||"[]") as VirtualCourseActivity[]; const match=items.find((item)=>String(item.practicalId??"")===practical.id); if(match){activity=match;courseCode=course.code;break;} }catch{} }
  if(!activity||!courseCode)return Response.json({error:"This practical is not attached to an active course in your enrolments."},{status:403});
  if(!contextCode&&enrolledCourses.results.length>1)return Response.json({error:"Open the practical from the course you are taking."},{status:409});
  const access=await learningAccess(account.profile,courseCode);if(access.error)return access.error;
  const attemptsAllowed=Math.min(10,Math.max(1,Number(activity.attemptsAllowed)||3));
  if(activity.dueAt&&Date.parse(activity.dueAt)<Date.now())return Response.json({error:"The practical deadline has passed. Contact the teaching team."},{status:409});
  const evidence = form.get("evidence");
  let evidenceKey: string | null = null; let evidenceFileName: string | null = null;
  if (evidence instanceof File && evidence.size > 0) {
    const permitted = evidence.type.startsWith("video/") || evidence.type.startsWith("image/") || evidence.type === "application/pdf";
    if (!permitted) return Response.json({ error: "Evidence must be a video, image or PDF file." }, { status: 400 });
    if (evidence.size > 25 * 1024 * 1024) return Response.json({ error: "Practical evidence must be 25 MB or smaller." }, { status: 413 });
    evidenceKey = await putStoredFile(`virtual-lab-evidence/${practical.id}`, evidence, { contentType: evidence.type || "application/octet-stream", originalName: evidence.name, ownerEmail: account.profile.email, evidenceKind: practical.id });
    evidenceFileName = evidence.name;
  }
  const result=db.transaction(native=>{
    const previous=native.prepare("SELECT COUNT(*) count,MAX(passed) passed,MAX(CASE WHEN status='submitted' THEN 1 ELSE 0 END) pending FROM virtual_lab_submissions WHERE practical_id=? AND learner_email=? AND course_code=?").get(practical.id,account.profile!.email,courseCode) as {count:number;passed:number;pending:number};
    if(previous.passed)return {error:"You have already passed this practical."};
    if(previous.pending)return {error:"Your saved practical is awaiting feedback. Wait for its decision before using another attempt."};
    const attemptNumber=previous.count+1;if(attemptNumber>attemptsAllowed)return {error:`You have used all ${attemptsAllowed} permitted submission attempts for this practical.`};
    const inserted=native.prepare("INSERT INTO virtual_lab_submissions(practical_id,discipline,practical_title,learner_email,attempt_number,observations_json,answers_json,report,evidence_key,evidence_file_name,course_code,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,'submitted')").run(practical.id,practical.discipline,practical.title,account.profile!.email,attemptNumber,JSON.stringify(observations),JSON.stringify(answers),report,evidenceKey,evidenceFileName,courseCode);
    return {id:Number(inserted.lastInsertRowid),attemptNumber};
  });
  if("error" in result)return Response.json({error:result.error},{status:409});
  const aiMode=["ai_auto","ai_luna","ai_terra"].includes(String(activity.gradingMode||""));
  if(aiMode){await queueEvidence("virtual",result.id,courseCode,account.profile.email,{id:String(activity.id||`virtual-${practical.id}`),title:String(activity.title||practical.title),instructions:String(activity.instructions||practical.focus),rubric:String(activity.rubric||"Assess accuracy and interpretation"),maxMark:Math.max(1,Number(activity.maxMark)||100),gradingMode:activity.gradingMode as "ai_auto"|"ai_luna"|"ai_terra",evidence:{observations,answers,report,evidenceFileName}},Math.min(100,Math.max(1,Number(activity.passMark)||60)));after(()=>processEvidenceJobs().then(()=>{}));}
  await recordEngagement(account.profile.email,courseCode,"evidence");
  return Response.json({ submission: { id: result.id, practicalId: practical.id, attemptNumber:result.attemptNumber, status: "submitted" } }, { status: 201 });
}

export async function PATCH(request: Request) {
  const payload=await request.json() as Record<string,unknown>;
  const {PATCH:markEvidence}=await import("@/app/api/delivery/evidence/route");
  return markEvidence(new Request(request.url,{method:"PATCH",headers:request.headers,body:JSON.stringify({...payload,type:"virtual"})}));
}
