import type { CourseMaterialRecord } from "@/lib/course-design";

export type StructuredLearningActivity = {
  id: string;
  kind: "inline" | "colab" | "virtual_lab";
  title: string;
  instructions: string;
  required: boolean;
  passMark: number;
  attemptsAllowed: number;
  maxMark?: number;
  dueAt?: string;
  rubric?: string;
  notebookKey?: string;
  notebookFileName?: string;
  templateUrl?: string;
  practicalId?: string;
  discipline?: string;
  sectionId?: string;
  sectionTitle?: string;
  materialId?: string;
  responseType?: "short_text" | "long_text" | "file" | "image" | "link";
  responseEntryMode?: "type" | "paste" | "either";
  correctAnswer?: string;
  feedbackCorrect?: string;
  feedbackIncorrect?: string;
  learnerAdvice?: string;
  gradingMode?: "facilitator" | "rule" | "ai_auto" | "ai_luna" | "ai_terra";
  promptImageUrl?: string;
  promptImageAlt?: string;
  promptImagePlacement?: "above" | "below" | "left" | "right";
  promptImageSize?: "small" | "medium" | "large" | "full";
};

const asRecord = (value: unknown) => value && typeof value === "object" ? value as Record<string, unknown> : {};
const clip = (value: unknown, limit: number) => String(value ?? "").trim().slice(0, limit);
const decodeBasicEntities = (value: string) => value.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'");
const htmlToText = (value: unknown) => decodeBasicEntities(String(value ?? "").replace(/<br\s*\/?\s*>/gi, "\n").replace(/<\/p\s*>/gi, "\n").replace(/<\/li\s*>/gi, "\n").replace(/<[^>]+>/g, " ")).replace(/[ \t]+/g, " ").replace(/\n\s+/g, "\n").trim();
const embeddedActivityText = (material: CourseMaterialRecord) => {
  const html = String(material.readableHtml ?? "");
  const heading = html.match(/<h[1-6][^>]*>\s*(?:learning\s+)?activity\s*<\/h[1-6]>\s*([\s\S]*?)(?=<h[1-6][^>]*>|$)/i);
  if (heading?.[1]) return clip(htmlToText(heading[1]), 12000);
  const text = clip(material.plainText, 20000) || htmlToText(html);
  const plain = text.match(/(?:^|\n)\s*(?:learning\s+)?activity\s*(?:\n|:)\s*([\s\S]+)/i);
  return clip(plain?.[1], 12000);
};

/**
 * Backward-compatibility bridge for courses authored before lesson activities became
 * first-class records. A material explicitly saved with kind "Activity" becomes a
 * structured inline activity so learners receive a response field and it can be
 * assessed. Existing explicit activity records always win.
 */
export function ensureStructuredLearningActivities(materials: CourseMaterialRecord[], rawActivities: unknown): StructuredLearningActivity[] {
  const activities: StructuredLearningActivity[] = Array.isArray(rawActivities)
    ? rawActivities.map((item, index) => {
        const a = asRecord(item);
        const kind = a.kind === "colab" || a.kind === "virtual_lab" ? a.kind : "inline";
        return {
          ...a,
          id: clip(a.id, 100) || `activity-${index + 1}`,
          kind,
          title: clip(a.title, 240) || "Learning activity",
          instructions: clip(a.instructions, 12000) || "Complete the learning activity and submit your response.",
          required: kind === "inline" ? a.required !== false : false,
          passMark: Math.min(100, Math.max(1, Number(a.passMark) || 60)),
          attemptsAllowed: Math.min(20, Math.max(1, Number(a.attemptsAllowed) || 3)),
          maxMark: Math.max(1, Number(a.maxMark) || 100),
          responseType: ["short_text","long_text","file","image","link"].includes(String(a.responseType)) ? a.responseType as StructuredLearningActivity["responseType"] : "long_text",
          responseEntryMode: ["type","paste","either"].includes(String(a.responseEntryMode)) ? a.responseEntryMode as StructuredLearningActivity["responseEntryMode"] : "either",
          gradingMode: ["facilitator","rule","ai_auto","ai_luna","ai_terra"].includes(String(a.gradingMode)) ? a.gradingMode as StructuredLearningActivity["gradingMode"] : "ai_auto",
        } as StructuredLearningActivity;
      })
    : [];

  const linkedMaterialIds = new Set(activities.filter((item) => item.kind === "inline" && item.materialId).map((item) => String(item.materialId)));
  for (const [index, material] of materials.entries()) {
    const materialId = String(material.id ?? `material-${index + 1}`);
    if (linkedMaterialIds.has(materialId)) continue;
    const explicitActivityMaterial = String(material.kind ?? "").toLowerCase() === "activity";
    const embedded = embeddedActivityText(material);
    if (!explicitActivityMaterial && !embedded) continue;
    const evidenceText = embedded || clip(material.plainText, 12000) || clip(material.title, 240);
    activities.push({
      id: `inline-${materialId}`,
      kind: "inline",
      materialId,
      sectionId: material.sectionId,
      sectionTitle: material.sectionTitle,
      title: clip(material.title, 240) || "Section learning activity",
      instructions: evidenceText || "Complete the activity described in this learning block and submit your response.",
      required: material.required !== false,
      passMark: 60,
      attemptsAllowed: 3,
      maxMark: 100,
      responseType: "long_text",
      responseEntryMode: "either",
      gradingMode: "ai_auto",
      rubric: "Assess the learner's response for completion of the stated task, relevance to the lesson, accuracy, use of appropriate evidence or reasoning, clarity, and fulfilment of every instruction. Award marks proportionately out of 100 and provide specific improvement feedback.",
      learnerAdvice: "Use the feedback to improve any criterion that did not yet meet the required standard.",
      feedbackCorrect: "You have met the required standard for this activity.",
      feedbackIncorrect: "The required standard has not yet been met. Review the feedback and improve your response before another attempt.",
    });
  }
  return activities;
}
