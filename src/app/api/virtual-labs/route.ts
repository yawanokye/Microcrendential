import { getRawDb } from "@/db/raw";
import { requireActiveProfile } from "@/lib/accounts";
import { issueCertificateIfComplete } from "@/lib/course-completion";
import { gradeActivityEvidenceWithAi } from "@/lib/assessment-ai";
import { getVirtualPractical, virtualPracticals } from "@/lib/virtual-labs";
import { putStoredFile } from "@/lib/render-storage";

type VirtualCourseActivity = {
  id?: string; title?: string; instructions?: string; rubric?: string; maxMark?: number; passMark?: number; attemptsAllowed?: number; gradingMode?: string; practicalId?: string;
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
  const enrolledCourses=await db.prepare(`SELECT c.code,c.activities_json FROM course_drafts c JOIN enrollments e ON e.course_code=c.code AND e.user_email=? AND e.status IN ('active','completed') WHERE c.status='active' AND instr(c.activities_json,'"practicalId":"' || ? || '"')>0`).bind(account.profile.email,practical.id).all<{code:string;activities_json:string}>();
  let activity: VirtualCourseActivity | null = null; let courseCode="";
  for(const course of enrolledCourses.results){ try{ const items=JSON.parse(course.activities_json||"[]") as VirtualCourseActivity[]; const match=items.find((item)=>String(item.practicalId??"")===practical.id); if(match){activity=match;courseCode=course.code;break;} }catch{} }
  if(!activity||!courseCode)return Response.json({error:"This practical is not attached to an active course in your enrolments."},{status:403});
  const previous = await db.prepare("SELECT COUNT(*) AS count FROM virtual_lab_submissions WHERE practical_id = ? AND learner_email = ?").bind(practical.id, account.profile.email).first<{ count: number }>();
  const attemptNumber = Number(previous?.count ?? 0) + 1;
  const attemptsAllowed=Math.min(10,Math.max(1,Number(activity.attemptsAllowed)||3));
  if (attemptNumber > attemptsAllowed) return Response.json({ error: `You have used all ${attemptsAllowed} permitted submission attempts for this practical.` }, { status: 409 });
  const evidence = form.get("evidence");
  let evidenceKey: string | null = null; let evidenceFileName: string | null = null;
  if (evidence instanceof File && evidence.size > 0) {
    const permitted = evidence.type.startsWith("video/") || evidence.type.startsWith("image/") || evidence.type === "application/pdf";
    if (!permitted) return Response.json({ error: "Evidence must be a video, image or PDF file." }, { status: 400 });
    if (evidence.size > 25 * 1024 * 1024) return Response.json({ error: "Practical evidence must be 25 MB or smaller." }, { status: 413 });
    evidenceKey = await putStoredFile(`virtual-lab-evidence/${practical.id}`, evidence, { contentType: evidence.type || "application/octet-stream", originalName: evidence.name, ownerEmail: account.profile.email, evidenceKind: practical.id });
    evidenceFileName = evidence.name;
  }
  const result = await db.prepare(`
    INSERT INTO virtual_lab_submissions
      (practical_id, discipline, practical_title, learner_email, attempt_number, observations_json, answers_json, report, evidence_key, evidence_file_name, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted')
  `).bind(practical.id, practical.discipline, practical.title, account.profile.email, attemptNumber, JSON.stringify(observations), JSON.stringify(answers), report, evidenceKey, evidenceFileName).run();
  const aiMode=["ai_auto","ai_luna","ai_terra"].includes(String(activity.gradingMode||""));
  if(aiMode){
    let grade;
    try{ grade=await gradeActivityEvidenceWithAi({id:String(activity.id||`virtual-${practical.id}`),title:String(activity.title||practical.title),instructions:String(activity.instructions||practical.focus),rubric:String(activity.rubric||"Assess completion, accuracy, interpretation, documentation and reflection."),maxMark:Math.max(1,Number(activity.maxMark)||100),gradingMode:activity.gradingMode as "ai_auto"|"ai_luna"|"ai_terra",evidence:{observations,answers,report,evidenceFileName}}); }
    catch(error){ await db.prepare("DELETE FROM virtual_lab_submissions WHERE id=?").bind(result.meta.last_row_id).run(); return Response.json({error:error instanceof Error?error.message:"Automated practical grading could not be completed."},{status:503}); }
    const maxMark=Math.max(1,Number(activity.maxMark)||100),mark=Math.floor(grade.earned),passMark=Math.min(100,Math.max(1,Number(activity.passMark)||60)),passed=(mark/maxMark)*100>=passMark,feedback=[grade.feedback,grade.learnerAdvice].filter(Boolean).join("\n\n");
    await db.prepare("UPDATE virtual_lab_submissions SET status='assessed',mark=?,passed=?,feedback=?,competency_note=?,assessed_by_email=?,assessed_at=CURRENT_TIMESTAMP WHERE id=?").bind(mark,passed?1:0,feedback,`Automatically assessed against the approved rubric using ${grade.model}.`,`AI:${grade.model}`,result.meta.last_row_id).run();
    const completion=passed?await issueCertificateIfComplete(account.profile.email,courseCode):null;
    return Response.json({submission:{id:result.meta.last_row_id,practicalId:practical.id,attemptNumber,status:"assessed",mark,passed,feedback,model:grade.model},completion:completion?.evaluation??null,certificate:completion?.certificate??null},{status:201});
  }
  return Response.json({ submission: { id: result.meta.last_row_id, practicalId: practical.id, attemptNumber, status: "submitted" } }, { status: 201 });
}

export async function PATCH(request: Request) {
  const account = await requireActiveProfile(["facilitator", "admin"]);
  if (account.error || !account.profile) return account.error;
  const payload = await request.json() as { id?: number; mark?: number; feedback?: string; competencyNote?: string; decision?: "competent" | "developing" | "resubmit" };
  const id = Number(payload.id); const suppliedMark = Number(payload.mark); const feedback = String(payload.feedback ?? "").trim(); const competencyNote = String(payload.competencyNote ?? "").trim();
  if (!id || !["competent", "developing", "resubmit"].includes(payload.decision ?? "")) return Response.json({ error: "Choose a valid competency decision." }, { status: 400 });
  if (!Number.isFinite(suppliedMark) || suppliedMark < 0) return Response.json({ error: "Enter a valid non-negative mark." }, { status: 400 });
  if (!feedback || !competencyNote) return Response.json({ error: "Provide feedback and a competency note." }, { status: 400 });
  const db = getRawDb();
  const existing = account.profile.role === "admin"
    ? await db.prepare("SELECT id, learner_email, practical_id FROM virtual_lab_submissions WHERE id = ? LIMIT 1").bind(id).first<{ id: number; learner_email: string; practical_id: string }>()
    : await db.prepare(`
        SELECT s.id, s.learner_email, s.practical_id FROM virtual_lab_submissions s
        WHERE s.id = ? AND EXISTS (
          SELECT 1 FROM course_drafts c
          WHERE c.created_by_email = ? AND c.status = 'active'
            AND instr(c.activities_json, '"practicalId":"' || s.practical_id || '"') > 0
        ) LIMIT 1
      `).bind(id, account.profile.email).first<{ id: number; learner_email: string; practical_id: string }>();
  if (!existing) return Response.json({ error: "The practical submission was not found." }, { status: 404 });
  const courseRows = account.profile.role === "admin"
    ? await db.prepare(`SELECT code,activities_json FROM course_drafts WHERE status='active' AND instr(activities_json, '"practicalId":"' || ? || '"')>0 ORDER BY updated_at DESC`).bind(existing.practical_id).all<{code:string;activities_json:string}>()
    : await db.prepare(`SELECT code,activities_json FROM course_drafts WHERE status='active' AND created_by_email=? AND instr(activities_json, '"practicalId":"' || ? || '"')>0 ORDER BY updated_at DESC`).bind(account.profile.email,existing.practical_id).all<{code:string;activities_json:string}>();
  let activityConfig: VirtualCourseActivity | null = null;
  for(const course of courseRows.results){try{const activities=JSON.parse(course.activities_json||"[]") as VirtualCourseActivity[];const match=activities.find((item)=>String(item.practicalId??"")===existing.practical_id);if(match){activityConfig=match;break;}}catch{}}
  const maxMark=Math.max(1,Number(activityConfig?.maxMark)||100),passMark=Math.min(100,Math.max(1,Number(activityConfig?.passMark)||60)),mark=Math.floor(suppliedMark);
  if(mark>maxMark)return Response.json({error:`Enter a mark between 0 and ${maxMark}.`},{status:400});
  const passed = payload.decision === "competent" && (mark / maxMark) * 100 >= passMark;
  const status = payload.decision === "resubmit" ? "resubmit" : "assessed";
  await db.prepare("UPDATE virtual_lab_submissions SET status = ?, mark = ?, passed = ?, feedback = ?, competency_note = ?, assessed_by_email = ?, assessed_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(status, mark, passed ? 1 : 0, feedback, competencyNote, account.profile.email, id).run();
  const completions = [];
  if (passed) {
    const courses = await db.prepare(`
      SELECT c.code FROM course_drafts c
      JOIN enrollments e ON e.course_code = c.code AND e.user_email = ? AND e.status IN ('active','completed')
      WHERE c.status = 'active' AND instr(c.activities_json, '"practicalId":"' || ? || '"') > 0
    `).bind(existing.learner_email, existing.practical_id).all<{ code: string }>();
    for (const course of courses.results) completions.push(await issueCertificateIfComplete(existing.learner_email, course.code));
  }
  return Response.json({ updated: true, passed, status, completions });
}
