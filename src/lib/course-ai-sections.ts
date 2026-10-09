import { normalizeCourseDesign, type CourseDesign } from "./course-design";
import type { CourseAiProposal, GenerateInput } from "./course-ai";
import { selectSectionSource } from "./course-source";
export function approvedCourseOutline(input: GenerateInput): { title: string; design: CourseDesign } {
  let raw: { title?: string; design?: CourseDesign };
  try { raw = JSON.parse(input.approvedOutline || ""); } catch { throw new Error("Approve a valid course outline before developing sections."); }
  if (!raw.title?.trim() || !Array.isArray(raw.design?.sections) || raw.design.sections.length < 1 || raw.design.sections.length > 12 || !raw.design.sections.every(s => s.id && s.title?.trim()) || new Set(raw.design.sections.map(s => s.id)).size !== raw.design.sections.length) throw new Error("The approved outline needs 1–12 distinct sections with titles.");
  if (!Array.isArray(raw.design.outcomes) || raw.design.outcomes.length < 2 || raw.design.outcomes.length > 8 || !raw.design.outcomes.every(o => o.id && o.statement?.trim()) || new Set(raw.design.outcomes.map(o => o.id)).size !== raw.design.outcomes.length) throw new Error("Confirm 2–8 distinct learning outcomes in the outline.");
  return { title: raw.title.slice(0, 240), design: normalizeCourseDesign(raw.design) };
}
export function inputForSection(input: GenerateInput, index: number) {
  const outline = approvedCourseOutline(input), section = outline.design.sections[index];
  if (!section) throw new Error("The requested section is outside the approved outline.");
  const selected = selectSectionSource(input.sourceText, input.sourceSpans || [], `${section.title} ${section.description}`);
  return { input: { ...input, stage: "lessons" as const, sectionCount: 1, sectionTopic: `${section.title}: ${section.description}`, preferredTitle: outline.title, sourceText: selected.text, sourceSpans: selected.spans, approvedOutline: JSON.stringify({ title: outline.title, design: { ...outline.design, sections: [section] } }) }, ranges: selected.originalRanges, weakMatch: selected.weakMatch };
}
export function analysedCharacterCount(ranges: { start: number; end: number }[]) {
  const ordered = ranges.slice().sort((a, b) => a.start - b.start); let total = 0, end = 0;
  for (const range of ordered) { total += Math.max(0, range.end - Math.max(end, range.start)); end = Math.max(end, range.end); } return total;
}
export function combineSectionProposals(input: GenerateInput, proposals: CourseAiProposal[]): CourseAiProposal {
  const outline = approvedCourseOutline(input); if (proposals.length !== outline.design.sections.length) throw new Error("All approved sections must be completed before review.");
  const combined = structuredClone(proposals[0]); combined.id = crypto.randomUUID(); combined.mode = input.mode; combined.stage = "lessons";
  combined.draft.title = outline.title; combined.draft.design = outline.design; combined.draft.materials = []; combined.draft.activities = []; combined.draft.assessmentConfig.questions = []; combined.sectionSuggestions = []; combined.warnings = [];
  const ranges: { start: number; end: number }[] = [], labels = new Set<string>();
  proposals.forEach((proposal, index) => {
    const section = outline.design.sections[index], prefix = `ai-section-${index + 1}-`, materialIds = new Map(proposal.draft.materials.map(m => [m.id, `${prefix}${m.id}`]));
    // Align only matching approved statements, never matching list positions.
    const approvedIds = new Map(proposal.draft.design.outcomes.flatMap(o => { const approved = outline.design.outcomes.find(a => a.statement.trim().toLowerCase() === o.statement.trim().toLowerCase()); return approved ? [[o.id, approved.id] as const] : []; }));
    const mapIds = (ids: string[] | undefined) => (ids || []).flatMap(id => approvedIds.has(id) ? [approvedIds.get(id)!] : []);
    const materials = proposal.draft.materials.filter(m => index === 0 || !m.id?.startsWith("ai-source-")).map(m => ({ ...m, id: materialIds.get(m.id), sectionId: section.id, sectionTitle: section.title, outcomeIds: mapIds(m.outcomeIds), alignmentConfirmed: false }));
    if (materials.some(m => m.kind === "Read" && !m.outcomeIds.length)) combined.warnings.push(`${section.title}: some generated outcome statements did not match the approved outline. Confirm the lesson links manually.`);
    combined.draft.materials.push(...materials);
    combined.draft.activities.push(...proposal.draft.activities.filter(a => materials.some(m => m.id === materialIds.get(a.materialId))).map(a => ({ ...a, id: `${prefix}${a.id}`, materialId: materialIds.get(a.materialId), sectionId: section.id, sectionTitle: section.title })));
    combined.draft.assessmentConfig.questions.push(...proposal.draft.assessmentConfig.questions.slice(0, 4).map(q => ({ ...q, id: `${prefix}${q.id}`, outcomeIds: mapIds(q.outcomeIds as string[] | undefined) })));
    combined.sectionSuggestions.push(...proposal.sectionSuggestions.map(s => ({ ...s, sectionId: section.id, sectionTitle: section.title })));
    combined.warnings.push(...proposal.warnings.filter(w => !w.startsWith("This request analysed")));
    inputForSection(input, index).ranges.forEach(r => ranges.push(r));
    proposal.sourceCoverage?.analysedLabels?.forEach(label => labels.add(label));
  });
  combined.draft.questionLimit = Math.max(1, combined.draft.assessmentConfig.questions.length);
  combined.usage = { inputTokens: proposals.reduce((n, p) => n + (p.usage?.inputTokens || 0), 0), outputTokens: proposals.reduce((n, p) => n + (p.usage?.outputTokens || 0), 0) };
  combined.sourceCoverage = { suppliedCharacters: input.sourceTotalCharacters || input.sourceText.length, analysedCharacters: analysedCharacterCount(ranges), excerptVerified: combined.draft.materials.some(m => Boolean(m.sourceExcerpt)), analysedLabels: [...labels], extractionNote: input.sourceNote };
  if (combined.sourceCoverage.analysedCharacters < combined.sourceCoverage.suppliedCharacters) combined.warnings.push("Some source content was outside the selected section passages. Review the coverage labels and add missing topics before publication.");
  combined.warnings = [...new Set(combined.warnings)]; return combined;
}
