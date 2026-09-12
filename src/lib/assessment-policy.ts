export type AssessmentPair = { left: string; right: string; image?: string };
export type AssessmentQuestionRecord = { id: string; type: string; prompt?: string; options?: string[]; correctAnswer?: string; points?: number; scheme?: string; outcomeIds?: string[]; pairs?: AssessmentPair[]; videoUrl?: string; videoMode?: "whole" | "part" | "pause"; videoStart?: number; videoEnd?: number; whiteboardEnabled?: boolean };
export type AssessmentConfigRecord = { passMark?: number; attempts?: string | number; questions?: AssessmentQuestionRecord[]; questionFiles?: unknown[] };

const MANUAL_TYPES = new Set(["short answer", "essay", "scenario response", "oral defence prompt", "evidence upload prompt", "practical assignment"]);
const normalizedType = (value: string) => value.trim().toLowerCase();
const same = (a: unknown, b: unknown) => String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();

export function requiresHumanMarking(question: AssessmentQuestionRecord) {
  if (MANUAL_TYPES.has(normalizedType(question.type))) return true;
  return normalizedType(question.type) === "video question" && !(question.options?.length && question.correctAnswer);
}
export function allowedAttempts(config: AssessmentConfigRecord) { return Math.min(20, Math.max(1, Number(String(config.attempts ?? "1").match(/\d+/)?.[0]) || 1)); }
export function learnerSafeAssessmentConfig(config: AssessmentConfigRecord, limit = 100) {
  return { passMark: Math.min(100, Math.max(1, Number(config.passMark) || 70)), attempts: String(allowedAttempts(config)), questions: (config.questions ?? []).slice(0, limit).map((q) => ({ id: q.id, type: q.type, prompt: q.prompt ?? "", options: q.options ?? [], points: Math.max(1, Number(q.points) || 1), outcomeIds: q.outcomeIds ?? [], pairs: (q.pairs ?? []).map((pair) => ({ left: pair.left, image: pair.image })), pairOptions: [...new Set((q.pairs ?? []).map((pair) => pair.right).filter(Boolean))].reverse(), videoUrl: q.videoUrl, videoMode: q.videoMode, videoStart: q.videoStart, videoEnd: q.videoEnd, whiteboardEnabled: q.whiteboardEnabled, markingMode: requiresHumanMarking(q) ? "human" : "automatic" })) };
}
export function gradeAutomaticQuestions(questions: AssessmentQuestionRecord[], answers: Record<string, unknown>) {
  let earned = 0, autoAvailable = 0, manualAvailable = 0, total = 0;
  const feedback: { questionId: string; correct: boolean | null; earned: number; available: number; markingMode: "automatic" | "human" }[] = [];
  for (const q of questions) {
    const points = Math.max(1, Number(q.points) || 1); total += points;
    if (requiresHumanMarking(q)) { manualAvailable += points; feedback.push({ questionId:q.id, correct:null, earned:0, available:points, markingMode:"human" }); continue; }
    autoAvailable += points; let correct = false; const answer = answers[q.id];
    if (["matching", "drag and drop", "picture matching"].includes(normalizedType(q.type))) { const expected = Object.fromEntries((q.pairs ?? []).map((pair) => [pair.left, pair.right])); const actual = answer && typeof answer === "object" ? answer as Record<string, unknown> : {}; correct = Object.keys(expected).length > 0 && Object.entries(expected).every(([left,right]) => same(actual[left], right)); }
    else correct = same(answer, q.correctAnswer);
    if (correct) earned += points; feedback.push({ questionId:q.id, correct, earned:correct ? points : 0, available:points, markingMode:"automatic" });
  }
  return { automaticScore:autoAvailable ? Math.round(earned/autoAvailable*100) : null, provisionalOverallScore:total ? Math.round(earned/total*100) : 0, needsHumanMarking:manualAvailable > 0, feedback };
}
export function validateAssessmentForPublication(config: AssessmentConfigRecord, limit = 100) {
  const questions=(config.questions ?? []).slice(0,limit); const issues:string[]=[];
  questions.forEach((q,index)=>{ const label=`Question ${index+1}`; if(!q.id||!q.prompt?.trim()) issues.push(`${label} needs an ID and prompt.`); if(!q.outcomeIds?.length) issues.push(`${label} must map to a learning outcome.`); if(requiresHumanMarking(q)){if(!q.scheme?.trim()||q.scheme.trim().length<20)issues.push(`${label} requires a marking rubric.`);}else if(["matching","drag and drop","picture matching"].includes(normalizedType(q.type))){if(!q.pairs?.length||q.pairs.some(p=>!p.left.trim()||!p.right.trim()))issues.push(`${label} needs complete matching pairs.`);}else if(!q.correctAnswer?.trim())issues.push(`${label} needs a correct answer.`); });
  return { valid:questions.length>0&&issues.length===0, issues };
}
