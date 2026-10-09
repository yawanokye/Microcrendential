import type { CourseAiProposal } from "./course-ai";
import type { CourseDesign, CourseMaterialRecord } from "./course-design";
import type { StructuredLearningActivity } from "./structured-learning-activities";
export type StudioAiSnapshot = {
  title: string; code: string; discipline: string; description: string; design: CourseDesign;
  materials: CourseMaterialRecord[]; activities: StructuredLearningActivity[];
  assessmentModes: string[]; assessmentConfig: { passMark: number; attempts: string; questions: Array<Record<string, unknown>>; questionFiles: unknown[] };
  gateRequired: boolean; questionLimit: number; certificateEnabled: boolean;
};
export type AiChangeSelection = { overview: boolean; materials: boolean; questions: boolean; activities: boolean };
/** Improvement appends selected teaching content with fresh IDs. Settings and previous approvals survive. */
export function mergeAiDraft(current: StudioAiSnapshot, proposal: CourseAiProposal["draft"], select: AiChangeSelection): StudioAiSnapshot {
  const result = structuredClone(current);
  if (select.overview) { result.title = proposal.title; result.discipline = proposal.discipline; result.description = proposal.description; }
  if (!select.materials && !select.questions && !select.activities) return result;
  const prefix = `ai-${crypto.randomUUID().slice(0, 8)}-`;
  // Link by exact outcome meaning only. Never use list position to infer alignment.
  const outcomeMap = new Map<string,string>();
  for (const o of proposal.design.outcomes) {
    const existing = result.design.outcomes.find(e => e.statement.trim().toLowerCase() === o.statement.trim().toLowerCase());
    const id = existing?.id || `${prefix}${o.id}`;
    outcomeMap.set(o.id, id);
    if (!existing) result.design.outcomes.push({ ...o, id });
  }
  const sectionMap = new Map<string,string>();
  for (const s of proposal.design.sections) {
    const existing = result.design.sections.find(e => e.title.trim().toLowerCase() === s.title.trim().toLowerCase());
    const id = existing?.id || `${prefix}${s.id}`;
    sectionMap.set(s.id, id);
    if (!existing) result.design.sections.push({ ...s, id });
  }
  const materialMap = new Map(proposal.materials.map((m,i) => [m.id || `material-${i}`, `${prefix}${m.id || i}`]));
  const remapOutcomes = (ids: unknown) => Array.isArray(ids) ? ids.map(String).map(id => outcomeMap.get(id)).filter((id): id is string => Boolean(id)) : [];
  if (select.materials || select.activities) result.materials.push(...proposal.materials.filter(m => select.materials || proposal.activities.some(a => a.materialId === m.id)).map(m => ({ ...m, id: materialMap.get(m.id!), sectionId: sectionMap.get(m.sectionId!), outcomeIds: remapOutcomes(m.outcomeIds) })));
  if (select.activities) result.activities.push(...proposal.activities.map(a => ({ ...a, id: `${prefix}${a.id}`, materialId: materialMap.get(a.materialId!), sectionId: sectionMap.get(a.sectionId!) })));
  if (select.questions) { result.assessmentConfig.questions.push(...proposal.assessmentConfig.questions.map(q => ({ ...q, id: `${prefix}${q.id}`, outcomeIds: remapOutcomes(q.outcomeIds), approved: false, previewed: false }))); result.questionLimit = Math.max(current.questionLimit, result.assessmentConfig.questions.length); }
  return result;
}
