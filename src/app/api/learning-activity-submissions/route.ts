import { gradeInteractive } from "@/lib/interactive-activities";
import { Buffer } from "node:buffer";
import { getRawDb } from "@/db/raw";
import { requireActiveProfile } from "@/lib/accounts";
import { after } from "next/server";
import { queueEvidence, processEvidenceJobs } from "@/lib/evidence-workflow";
import { learningAccess, recordEngagement } from "@/lib/course-access";
import { issueCertificateIfComplete } from "@/lib/course-completion";
import { extractReadableContent } from "@/lib/document-content";
import { rejectCrossSiteMutation } from "@/lib/request-security";
import { putStoredFile } from "@/lib/render-storage";
import { ensureStructuredLearningActivities } from "@/lib/structured-learning-activities";
import type { CourseMaterialRecord } from "@/lib/course-design";

const parseJson = <T,>(value: string, fallback: T) => { try { return JSON.parse(value || "") as T; } catch { return fallback; } };
const parseActivities = (materialsJson: string, activitiesJson: string) => ensureStructuredLearningActivities(
  parseJson<CourseMaterialRecord[]>(materialsJson, []),
  parseJson<unknown[]>(activitiesJson, []),
).filter((item) => item.kind === "inline");
const normalized = (value: unknown) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

export async function GET(request: Request) {
  const account = await requireActiveProfile(); if (account.error || !account.profile) return account.error;
  const url = new URL(request.url); const courseCode = url.searchParams.get("courseCode")?.trim() ?? ""; const activityId = url.searchParams.get("activityId")?.trim() ?? "";
  const db = getRawDb();
  if (account.profile.role === "learner") {
    const rows = await db.prepare(`SELECT id,course_code,material_id,activity_id,attempt_number,response_type,status,mark,max_mark,pass_mark,passed,feedback,criteria_json,grading_mode,model,evidence_file_name,submitted_at,assessed_at FROM material_activity_submissions WHERE user_email=? AND (?='' OR course_code=?) AND (?='' OR activity_id=?) ORDER BY submitted_at DESC LIMIT 100`).bind(account.profile.email,courseCode,courseCode,activityId,activityId).all<Record<string,unknown>>();
    return Response.json({ submissions: rows.results });
  }
  const rows = account.profile.role === "admin"
    ? await db.prepare(`SELECT s.*,u.full_name learner_name,c.title course_title FROM material_activity_submissions s LEFT JOIN users u ON u.email=s.user_email JOIN course_drafts c ON c.code=s.course_code WHERE (?='' OR s.course_code=?) ORDER BY s.submitted_at DESC LIMIT 250`).bind(courseCode,courseCode).all<Record<string,unknown>>()
    : await db.prepare(`SELECT s.*,u.full_name learner_name,c.title course_title FROM material_activity_submissions s LEFT JOIN users u ON u.email=s.user_email JOIN course_drafts c ON c.code=s.course_code WHERE c.created_by_email=? AND (?='' OR s.course_code=?) ORDER BY s.submitted_at DESC LIMIT 250`).bind(account.profile.email,courseCode,courseCode).all<Record<string,unknown>>();
  return Response.json({ submissions: rows.results });
}

export async function POST(request: Request) {
  const origin = rejectCrossSiteMutation(request); if (origin) return origin;
  const account = await requireActiveProfile(["learner"]); if (account.error || !account.profile) return account.error;
  const form = await request.formData();
  const courseCode = String(form.get("courseCode") ?? "").trim();
  const activityId = String(form.get("activityId") ?? "").trim();
  const responseText = String(form.get("responseText") ?? "").trim().slice(0, 100_000);
  const evidence = form.get("evidence"); const hasFile = evidence instanceof File && evidence.size > 0;
  if (!courseCode || !activityId) return Response.json({ error: "Course and learning activity are required." }, { status: 400 });
  const db = getRawDb();
  const access=await learningAccess(account.profile,courseCode);if(access.error)return access.error;const course=access.course;
  if (!course) return Response.json({ error: "This learning activity is unavailable or you are not enrolled." }, { status: 403 });
  const activity = parseActivities(course.materials_json, course.activities_json).find((item) => String(item.id ?? "") === activityId);
  if (!activity || !activity.materialId) return Response.json({ error: "The structured learning activity was not found." }, { status: 404 });
  if (activity.lti) return Response.json({error:"Complete this activity in the registered learning tool. Results must arrive through its authenticated grade service."},{status:409});
  if (activity.dueAt && Date.parse(activity.dueAt) < Date.now()) return Response.json({ error: "The deadline for this learning activity has passed. Contact the teaching team." }, { status: 409 });
  const responseType = activity.responseType ?? "long_text";
  if (["short_text","long_text"].includes(responseType) && !responseText) return Response.json({ error: "Enter your response before submitting the activity." }, { status: 400 });
  if (responseType === "link") {
    try { const url = new URL(responseText); if (url.protocol !== "https:") throw new Error(); }
    catch { return Response.json({ error: "Submit a complete HTTPS evidence link." }, { status: 400 }); }
  }
  if (["file","image"].includes(responseType) && !hasFile) return Response.json({ error: responseType === "image" ? "Upload the required image, drawing or chart." : "Upload the required evidence file." }, { status: 400 });
  if (hasFile && evidence.size > 15 * 1024 * 1024) return Response.json({ error: "Learning-activity evidence must be 15 MB or smaller." }, { status: 413 });
  if (hasFile && evidence.type.startsWith("image/") && evidence.size > 8 * 1024 * 1024) return Response.json({ error: "Images used for automated visual grading must be 8 MB or smaller." }, { status: 413 });
  if (responseType === "image" && hasFile && !evidence.type.startsWith("image/")) return Response.json({ error: "This activity requires an image, drawing or chart file." }, { status: 400 });

  const attemptsAllowed = Math.min(20, Math.max(1, Number(activity.attemptsAllowed) || 1));

  const maxMark = Math.max(1, Math.floor(Number(activity.maxMark) || 100)); const passMark = Math.min(100, Math.max(1, Math.floor(Number(activity.passMark) || 60)));
  const gradingMode = activity.gradingMode ?? "ai_auto";
  if (gradingMode !== "rule" && !activity.rubric?.trim()) return Response.json({ error: "The approved rubric is missing." }, { status: 409 });
  let mark = 0, passed = false, feedback = "", imageDataUrl: string | undefined, extractedEvidence = ""; let criteria:unknown[]=[];const model:string|null=null;
  let evidenceKey: string | null = null, evidenceFileName: string | null = null, evidenceMimeType: string | null = null;

  if (hasFile) {
    const buffer = Buffer.from(await evidence.arrayBuffer()); evidenceFileName = evidence.name.slice(0, 240); evidenceMimeType = (evidence.type || "application/octet-stream").slice(0, 120);
    if (evidence.type.startsWith("image/")) imageDataUrl = `data:${evidence.type};base64,${buffer.toString("base64")}`;
    else {
      try { extractedEvidence = extractReadableContent(buffer, evidence.name, evidence.type).text.slice(0, 80_000); } catch { extractedEvidence = ""; }
      if (!extractedEvidence && !["rule", "facilitator"].includes(gradingMode)) return Response.json({ error: "The uploaded evidence could not be converted into readable text for automated grading. Upload a readable PDF, DOCX, text file or image." }, { status: 400 });
    }
  }

  if (hasFile) evidenceKey = await putStoredFile(`learning-activity-evidence/${courseCode}/${activityId}`, evidence, { contentType:evidence.type || "application/octet-stream", originalName:evidence.name, ownerEmail:account.profile.email, evidenceKind:"learning-activity" });
  function saveAttempt(assessed: boolean): { error: string } | { id: number; attemptNumber: number } {
    return db.transaction(native => {
      const previous = native.prepare("SELECT COUNT(*) count, MAX(passed) passed, MAX(CASE WHEN status IN ('submitted','awaiting_marking') THEN 1 ELSE 0 END) pending FROM material_activity_submissions WHERE user_email=? AND course_code=? AND activity_id=?").get(account.profile!.email, courseCode, activityId) as { count: number; passed: number; pending: number };
      if (previous.passed) return { error: "You have already passed this learning activity. Your evidence remains available for review." };
      if (previous.pending) return { error: "Your previous evidence is saved and awaiting feedback. Wait for its decision before using another attempt." };
      const attemptNumber = previous.count + 1;
      if (attemptNumber > attemptsAllowed) return { error: "You have used all permitted attempts for this learning activity." };
      const result = native.prepare("INSERT INTO material_activity_submissions(user_email,course_code,material_id,activity_id,attempt_number,response_type,response_text,evidence_key,evidence_file_name,evidence_mime_type,status,mark,max_mark,pass_mark,passed,feedback,criteria_json,grading_mode,model,assessed_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CASE WHEN ?=1 THEN CURRENT_TIMESTAMP ELSE NULL END)").run(account.profile!.email, courseCode, activity!.materialId!, activityId, attemptNumber, responseType, responseText, evidenceKey, evidenceFileName, evidenceMimeType, assessed ? "assessed" : "submitted", assessed ? mark : null, maxMark, passMark, assessed && passed ? 1 : 0, assessed ? feedback : "Evidence saved; feedback pending.", JSON.stringify(criteria), gradingMode, model, assessed ? 1 : 0);
      return { id: Number(result.lastInsertRowid), attemptNumber };
    });
  }
  if (gradingMode !== "rule") {
    const result = saveAttempt(false); if ("error" in result) return Response.json({ error: result.error }, { status: 409 });
    if(gradingMode!=="facilitator") {await queueEvidence("inline",result.id,courseCode,account.profile.email,{id:activityId,title:activity.title||"Learning activity",instructions:activity.instructions||"Complete the activity",rubric:activity.rubric!,maxMark,gradingMode:gradingMode as "ai_auto"|"ai_luna"|"ai_terra",evidence:[responseText,extractedEvidence].filter(Boolean).join("\n\n"),imageDataUrl},passMark);after(()=>processEvidenceJobs().then(()=>{}));}
    await recordEngagement(account.profile.email,courseCode,"evidence");
    return Response.json({submission:{id:result.id,activityId,materialId:activity.materialId,attemptNumber:result.attemptNumber,status:"submitted",passed:false,feedback:"Your evidence is saved. Feedback will appear after grading."}},{status:202});
  }
  if (activity.interactive) {
    try { const graded = gradeInteractive(activity.interactive, JSON.parse(responseText), maxMark); mark = graded.mark; feedback = graded.feedback; criteria = graded.criteria; passed = mark / maxMark * 100 >= passMark; }
    catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Invalid interactive response." }, { status: 400 }); }
  } else if (gradingMode === "rule") {
    if (!["short_text","long_text","link"].includes(responseType)) return Response.json({ error: "Rule-based grading is available for text or link responses. Choose AI grading for image or document evidence." }, { status: 409 });
    const accepted = String(activity.correctAnswer ?? "").split(/\n|\|\|/).map(normalized).filter(Boolean);
    const correct = accepted.includes(normalized(responseText));
    mark = correct ? maxMark : 0; passed = (mark / maxMark) * 100 >= passMark;
    feedback = (correct ? activity.feedbackCorrect : activity.feedbackIncorrect)?.trim() || (correct ? "Correct. You have met the approved answer rule." : "The response does not yet meet the approved answer rule. Review the lesson and try again if another attempt is available.");
  }
  if (!feedback) return Response.json({ error: "The activity cannot be completed without recorded feedback." }, { status: 503 });


  const result = saveAttempt(true); if ("error" in result) return Response.json({ error: result.error }, { status: 409 });
  await recordEngagement(account.profile.email,courseCode,"evidence");
  const completion = passed ? await issueCertificateIfComplete(account.profile.email,courseCode) : null;
  return Response.json({ submission:{ id:result.id, activityId, materialId:activity.materialId, attemptNumber:result.attemptNumber, status:"assessed", mark, maxMark, passMark, passed, feedback, criteria, model }, completion:completion?.evaluation ?? null, certificate:completion?.certificate ?? null }, { status:201 });
}
