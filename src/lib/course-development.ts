import type { CourseDesign, CourseMaterialRecord } from "./course-design";
import type { StructuredLearningActivity } from "./structured-learning-activities";
import { assessmentRequired } from "./delivery-policy";

export type DevelopmentStage = "details" | "outcomes" | "content" | "activities" | "assessment";
type Question = { approved?: boolean; previewed?: boolean; outcomeIds?: string[]; id?: string };
export function courseDevelopmentReview({ design, materials, activities, questions }: { design: CourseDesign; materials: CourseMaterialRecord[]; activities: StructuredLearningActivity[]; questions: Question[] }) {
  const findings: { id: string; message: string; stage: DevelopmentStage }[] = [];
  const materialMap = new Map(materials.map(m => [m.id, m]));
  const validOutcomes = new Set(design.outcomes.map(o => o.id));
  const assessedQuestions = questions.filter(q => q.approved && q.previewed);
  const outcomes = design.outcomes.map(outcome => {
    const lessons = materials.filter(m => m.outcomeIds?.includes(outcome.id));
    const mappedActivities = activities.filter(a => a.kind === "inline" && a.materialId && materialMap.get(a.materialId)?.outcomeIds?.includes(outcome.id));
    const requiredPractice = mappedActivities.filter(a => a.required);
    return { ...outcome, lessons: lessons.length, questions: assessedQuestions.filter(q => q.outcomeIds?.includes(outcome.id)).length, requiredPractice: requiredPractice.length, optionalPractice: mappedActivities.length - requiredPractice.length };
  });
  if (design.credentialStructure !== "broader") {
    for (const outcome of outcomes) {
      if (!outcome.lessons) findings.push({ id: `lesson-${outcome.id}`, stage: "content", message: `No learning block develops “${outcome.statement}”.` });
      if (assessmentRequired(design.certificate.awardType) && !outcome.questions && !outcome.requiredPractice) findings.push({ id: `evidence-${outcome.id}`, stage: "assessment", message: `No approved, previewed question or required lesson activity currently supplies assessed evidence for “${outcome.statement}”.` });
    }
    if (materials.some(m => !m.outcomeIds?.length || m.outcomeIds.some(id => !validOutcomes.has(id)))) findings.push({ id: "lesson-links", stage: "content", message: "Some learning blocks have missing or outdated outcome links. Check each block before submission." });
    if (assessedQuestions.some(q => !q.outcomeIds?.length || q.outcomeIds.some(id => !validOutcomes.has(id)))) findings.push({ id: "question-links", stage: "assessment", message: "Some approved questions have missing or outdated outcome links." });
    if (materials.some(m => !m.id) || new Set(materials.map(m => m.id)).size !== materials.length) findings.push({ id: "material-ids", stage: "content", message: "Learning blocks need distinct identifiers so saved responses stay attached to the right lesson." });
    if (activities.some(a => a.kind === "inline" && (!a.materialId || !materialMap.has(a.materialId)))) findings.push({ id: "activity-link", stage: "content", message: "A lesson activity refers to a missing learning block. Reattach or remove it." });
    if (design.sections.some(section => !materials.some(m => m.sectionId === section.id))) findings.push({ id: "empty-sections", stage: "content", message: "One or more syllabus sections contain no learning blocks." });
  }
  const plannedMinutes = materials.reduce((sum, m) => sum + Math.max(0, Number(m.estimatedMinutes) || 0), 0), declaredMinutes = design.expectedHours * 60;
  if (materials.length && (plannedMinutes > declaredMinutes * 1.25 || plannedMinutes < declaredMinutes * .5)) findings.push({ id: "workload", stage: "details", message: `Learning blocks account for about ${(plannedMinutes / 60).toFixed(1)} hours against ${design.expectedHours} declared hours. Check lesson estimates and allow for assignments, reading and live work.` });
  return { outcomes, findings, plannedMinutes, declaredMinutes };
}

export const teachingFocusLabels = { general: "General or interdisciplinary", coding: "Coding", data_science: "Data science", ai: "AI and machine learning", cybersecurity: "Cybersecurity", experiment: "Scientific experimentation" } as const;
export type TeachingFocus = keyof typeof teachingFocusLabels;
export const normalizeTeachingFocus = (value: unknown): TeachingFocus => Object.hasOwn(teachingFocusLabels, String(value)) ? value as TeachingFocus : "general";
export function technicalTeachingGuidance(value: unknown) {
  const focus = normalizeTeachingFocus(value);
  const base = "Use a teach, demonstrate, practise, feedback and transfer sequence. State the task, required resources, expected evidence, assessment criteria and an estimated time. Native knowledge checks support practice but do not by themselves prove practical competence. Never claim a configured lab, code run, test result or connected tool exists unless supplied by the facilitator.";
  const detail: Record<TeachingFocus, string> = {
    general: "Use an authentic workplace or community task matched to the learning outcomes.",
    coding: "Teach code through worked examples, implementation tasks, meaningful tests and explanations. The native working lab runs JavaScript or Python, including NumPy and pandas, without general network access. R, additional packages and specialist environments need a facilitator-supplied Colab notebook or registered external tool. Include reproducibility and error analysis in the evidence requirements.",
    data_science: "Include data provenance, a dictionary, inspection, justified cleaning, analysis, visualisation, interpretation and limitations. Use synthetic or authorised data. A native CSV/Python/JavaScript lab supports small datasets and descriptive statistics. Do not invent a dataset, published statistic, attached file or execution result.",
    ai: "Include training/test separation, a baseline, evaluation metrics, error analysis, responsible use and limitations. The native AI lab supports a small linear regression experiment. Neural networks, GPU training and external model APIs need separately configured tools. Propose practical experiments rather than only terminology quizzes.",
    cybersecurity: "Use supplied synthetic logs and explicitly authorised practice targets. Include defensive investigation, evidence handling, rule testing, false positives, incident reasoning and proportionate response. The native lab analyses supplied logs and runs Python or JavaScript with supplied local assets. It is not a Linux shell, live network or cyber range. Specialist exercises require a configured isolated external environment.",
    experiment: "Distinguish protocol rehearsal from experimental work. Ask learners to identify variables, control a condition, collect repeated observations, calculate and plot results, interpret uncertainty and state model limitations. The native ideal resistor model uses Ohm's law. Other apparatus and physical competence require appropriate supervised or specialist environments.",
  };
  return `${base}\nTeaching focus: ${teachingFocusLabels[focus]}. ${detail[focus]}`;
}
