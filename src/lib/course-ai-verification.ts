import { courseAiStatus, generateCourseAiProposal, type CourseAiProposal, type CourseAiProvider, type GenerateInput } from "./course-ai";
import { interactiveIssues } from "./interactive-activities";
export type AiVerification = { status: "passed" | "needs_review"; checkedAt: string; latencyMs: number; checks: { label: string; passed: boolean }[] };
export const verificationSource = "Procurement decisions should be supported by verifiable evidence. An officer checks the source, applies the published criteria and documents the reason for the decision. A Ghanaian workplace example can use fictional suppliers and illustrative amounts. Illustrative examples must be labelled and must not be presented as institutional facts. An audit trail records the evidence reviewed, the decision and the responsible officer. Unsupported claims require facilitator review before publication.";
export function verificationInput(provider: CourseAiProvider): GenerateInput {
  return { mode: "idea", stage: "lessons", provider, sectionCount: 2, sourceText: verificationSource, preferredTitle: "AI connection verification", verification: true, brief: { audience: "Procurement officers in Ghana", level: "applied", durationHours: 2, goals: "Evaluate evidence and document a justified procurement decision.", deliveryMode: "asynchronous", awardType: "Participation" } };
}
export function checkAiVerification(proposal: CourseAiProposal, latencyMs: number): AiVerification {
  const lessons = proposal.draft.materials.filter(m => m.kind === "Read");
  const questions = proposal.draft.assessmentConfig.questions;
  const checks = [
    { label: "Configured provider returned a structured draft", passed: Boolean(proposal.provider && proposal.model && proposal.draft.title) },
    { label: "Two developed lessons contain usable text", passed: lessons.length >= 2 && lessons.every(m => (m.plainText?.length || 0) >= 200 && !m.developmentPending) },
    { label: "Assessment questions have valid answer keys", passed: questions.length > 0 && questions.every(q => q.type !== "Multiple choice" || Array.isArray(q.options) && q.options.includes(q.correctAnswer)) },
    { label: "Interactive activities have valid keys and feedback", passed: proposal.draft.activities.some(a => a.interactive) && proposal.draft.activities.filter(a => a.interactive).every(a => interactiveIssues(a.interactive).length === 0) },
    { label: "Lessons propose explicit outcome links and reasons", passed: lessons.length > 0 && lessons.every(m => m.outcomeIds?.length && m.alignmentReason?.trim()) },
    { label: "At least one excerpt matches the supplied verification source", passed: lessons.some(m => m.sourceExcerpt && verificationSource.includes(m.sourceExcerpt)) },
  ];
  return { status: checks.every(c => c.passed) ? "passed" : "needs_review", checkedAt: new Date().toISOString(), latencyMs, checks };
}
export async function runLiveAiVerification(provider: CourseAiProvider = "auto") {
  const status = courseAiStatus(); if (!status.available || provider !== "auto" && !status.providers.find(p => p.id === provider)?.configured) return { status: "not_configured" as const, message: "Configure an AI provider on the deployment before running live verification.", checkedAt: new Date().toISOString() };
  const started = Date.now();
  const proposal = await generateCourseAiProposal(verificationInput(provider));
  return { ...checkAiVerification(proposal, Date.now() - started), provider: proposal.provider, model: proposal.model, usage: proposal.usage };
}
