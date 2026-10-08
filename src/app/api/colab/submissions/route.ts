import { getRawDb } from "@/db/raw";
import { requireActiveProfile } from "@/lib/accounts";
import { issueCertificateIfComplete } from "@/lib/course-completion";
import { after } from "next/server";
import { queueEvidence, processEvidenceJobs } from "@/lib/evidence-workflow";
import { learningAccess, recordEngagement, coursePermission } from "@/lib/course-access";
import { reviewAffectedCredential } from "@/lib/grading-workflow";
import { putStoredFile } from "@/lib/render-storage";
import { rejectCrossSiteMutation } from "@/lib/request-security";

type SubmissionRow = {
  id: number; assignment_id: number; assignment_title: string; course_code: string; course_title: string;
  learner_email: string; learner_name: string; attempt_number: number; submission_type: string;
  notebook_file_name: string | null; notebook_url: string | null; status: string; mark: number | null;
  passed: number; feedback: string; max_mark: number; pass_mark: number; submitted_at: string; assessed_at: string | null;
};

function present(row: SubmissionRow) {
  return {
    id: row.id, assignmentId: row.assignment_id, assignmentTitle: row.assignment_title,
    courseCode: row.course_code, courseTitle: row.course_title, learnerEmail: row.learner_email,
    learnerName: row.learner_name, attemptNumber: row.attempt_number, submissionType: row.submission_type,
    notebookFileName: row.notebook_file_name, notebookUrl: row.notebook_url, status: row.status,
    mark: row.mark, passed: Boolean(row.passed), feedback: row.feedback, maxMark: row.max_mark,
    passMark: row.pass_mark, submittedAt: row.submitted_at, assessedAt: row.assessed_at,
  };
}

export async function GET() {
  const account = await requireActiveProfile();
  if (account.error || !account.profile) return account.error;
  const base = `
    SELECT s.*, a.title AS assignment_title, a.course_code, a.max_mark, a.pass_mark,
      c.title AS course_title, u.full_name AS learner_name
    FROM colab_submissions s
    JOIN colab_assignments a ON a.id = s.assignment_id
    JOIN course_drafts c ON c.code = a.course_code
    LEFT JOIN users u ON u.email = s.learner_email
  `;
  const db = getRawDb();
  let rows;
  if (account.profile.role === "learner") rows = await db.prepare(`${base} WHERE s.learner_email = ? ORDER BY s.submitted_at DESC`).bind(account.profile.email).all<SubmissionRow>();
  else if (account.profile.role === "facilitator") rows = await db.prepare(`${base} WHERE a.created_by_email = ? ORDER BY CASE s.status WHEN 'submitted' THEN 0 ELSE 1 END, s.submitted_at DESC`).bind(account.profile.email).all<SubmissionRow>();
  else rows = await db.prepare(`${base} ORDER BY CASE s.status WHEN 'submitted' THEN 0 ELSE 1 END, s.submitted_at DESC`).all<SubmissionRow>();
  return Response.json({ submissions: rows.results.map(present) });
}

export async function POST(request: Request) {
  const securityError = rejectCrossSiteMutation(request); if (securityError) return securityError;
  const account = await requireActiveProfile(["learner"]);
  if (account.error || !account.profile) return account.error;
  const form = await request.formData();
  const assignmentId = Number(form.get("assignmentId"));
  const sharingLink = String(form.get("sharingLink") ?? "").trim();
  const file = form.get("notebook");
  const hasFile = file instanceof File && file.size > 0;
  if (!assignmentId || (hasFile === Boolean(sharingLink))) return Response.json({ error: "Submit either one completed .ipynb file or one sharing link." }, { status: 400 });
  if (sharingLink) {
    try {
      const url = new URL(sharingLink);
      if (url.protocol !== "https:" || !["colab.research.google.com", "drive.google.com"].includes(url.hostname)) throw new Error();
    } catch { return Response.json({ error: "Use a valid Google Colab or Google Drive sharing link." }, { status: 400 }); }
  }
  let notebookText = "";
  if (hasFile) {
    if (!file.name.toLowerCase().endsWith(".ipynb")) return Response.json({ error: "Only completed .ipynb notebook files are accepted." }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return Response.json({ error: "Completed notebooks must be 10 MB or smaller." }, { status: 413 });
    try {
      notebookText = await file.text();
      const notebook = JSON.parse(notebookText) as { cells?: unknown[]; nbformat?: number };
      if (!Array.isArray(notebook.cells) || !Number.isInteger(notebook.nbformat)) throw new Error();
    } catch { return Response.json({ error: "The uploaded file is not a readable Jupyter notebook." }, { status: 400 }); }
  }
  const db = getRawDb();
  const assignment = await db.prepare(`
    SELECT a.id, a.course_code, a.title, a.instructions, a.rubric, a.max_mark, a.pass_mark, a.grading_mode, a.attempts_allowed, a.due_at
    FROM colab_assignments a JOIN course_drafts c ON c.code = a.course_code AND c.status = 'active'
    JOIN enrollments e ON e.course_code = a.course_code AND e.user_email = ? AND e.status IN ('active', 'completed')
    WHERE a.id = ? AND a.status = 'active' LIMIT 1
  `).bind(account.profile.email, assignmentId).first<{ id: number; course_code: string; title:string; instructions:string; rubric:string; max_mark:number; pass_mark:number; grading_mode:string; attempts_allowed: number; due_at: string | null }>();
  if (!assignment) return Response.json({ error: "This Colab assignment is unavailable or you are not enrolled." }, { status: 403 });
  const access=await learningAccess(account.profile,assignment.course_code);if(access.error)return access.error;
  if (assignment.due_at && Date.now() > Date.parse(assignment.due_at)) return Response.json({ error: "The submission deadline has passed. Contact the facilitator if an extension is required." }, { status: 409 });
  let key: string | null = null;
  let fileName: string | null = null;
  if (hasFile) {
    key = await putStoredFile(`colab-submissions/${assignmentId}`, file, { contentType: "application/x-ipynb+json", originalName: file.name, ownerEmail: account.profile.email });
    fileName = file.name;
  }
  const aiMode = ["ai_auto","ai_luna","ai_terra"].includes(assignment.grading_mode);
  if (aiMode && !hasFile) return Response.json({ error: "This activity uses automated rubric grading. Upload the completed .ipynb file so the grading engine can inspect the notebook evidence." }, { status: 400 });
  const result = db.transaction(native=>{
    const previous=native.prepare("SELECT COUNT(*) count,MAX(passed) passed,MAX(CASE WHEN status='submitted' THEN 1 ELSE 0 END) pending FROM colab_submissions WHERE assignment_id=? AND learner_email=?").get(assignmentId,account.profile!.email) as {count:number;passed:number;pending:number};
    if(previous.passed)return {error:"You have already passed this notebook activity."};
    if(previous.pending)return {error:"Your saved notebook is awaiting feedback. Wait for its decision before using another attempt."};
    const attemptNumber=previous.count+1;if(attemptNumber>assignment.attempts_allowed)return {error:"You have used all permitted submission attempts."};
    const inserted=native.prepare("INSERT INTO colab_submissions(assignment_id,learner_email,attempt_number,submission_type,notebook_key,notebook_file_name,notebook_url,status) VALUES(?,?,?,?,?,?,?,'submitted')").run(assignmentId,account.profile!.email,attemptNumber,hasFile?"file":"link",key,fileName,sharingLink||null);
    return {id:Number(inserted.lastInsertRowid),attemptNumber};
  });
  if("error" in result)return Response.json({error:result.error},{status:409});
  if(aiMode){await queueEvidence("colab",result.id,assignment.course_code,account.profile.email,{id:`colab-${assignment.id}`,title:assignment.title,instructions:assignment.instructions,rubric:assignment.rubric,maxMark:assignment.max_mark,gradingMode:assignment.grading_mode as "ai_auto"|"ai_luna"|"ai_terra",evidence:notebookText},assignment.pass_mark);after(()=>processEvidenceJobs().then(()=>{}));}
  await recordEngagement(account.profile.email,assignment.course_code,"evidence");
  return Response.json({ submission: { id: result.id, assignmentId, attemptNumber:result.attemptNumber, status: "submitted" } }, { status: 201 });
}

export async function PATCH(request: Request) {
  const payload=await request.json() as Record<string,unknown>;
  const {PATCH:markEvidence}=await import("@/app/api/delivery/evidence/route");
  return markEvidence(new Request(request.url,{method:"PATCH",headers:request.headers,body:JSON.stringify({...payload,type:"colab"})}));
}
