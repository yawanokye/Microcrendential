import { createHash } from "node:crypto";
import { gradingModeForQuestion, type AssessmentQuestionRecord } from "@/lib/assessment-policy";

export type AiCriterionFeedback = { criterion: string; score: number; maximum: number; feedback: string };
export type AiQuestionGrade = {
  questionId: string;
  model: string;
  earned: number;
  available: number;
  feedback: string;
  learnerAdvice: string;
  criteria: AiCriterionFeedback[];
  cachedInputTokens: number;
};

const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["score", "feedback", "learnerAdvice", "criteria"],
  properties: {
    score: { type: "number" },
    feedback: { type: "string" },
    learnerAdvice: { type: "string" },
    criteria: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["criterion", "score", "maximum", "feedback"],
        properties: {
          criterion: { type: "string" },
          score: { type: "number" },
          maximum: { type: "number" },
          feedback: { type: "string" },
        },
      },
    },
  },
} as const;

function outputText(payload: unknown) {
  const data = payload as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  return data.output_text || data.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text || "";
}

function modelFor(question: AssessmentQuestionRecord, answer: unknown) {
  const mode = gradingModeForQuestion(question);
  if (mode === "ai_terra") return process.env.OPENAI_ASSESSMENT_TERRA_MODEL?.trim() || "gpt-5.6-terra";
  if (mode === "ai_luna") return process.env.OPENAI_ASSESSMENT_LUNA_MODEL?.trim() || "gpt-5.6-luna";
  const answerLength = typeof answer === "string" ? answer.length : JSON.stringify(answer ?? "").length;
  const complex = /essay|practical|evidence upload|oral defence/i.test(question.type) || answerLength > 4000 || Number(question.points) >= 20;
  return complex ? (process.env.OPENAI_ASSESSMENT_TERRA_MODEL?.trim() || "gpt-5.6-terra") : (process.env.OPENAI_ASSESSMENT_LUNA_MODEL?.trim() || "gpt-5.6-luna");
}

function cacheKey(question: AssessmentQuestionRecord, model: string) {
  const stable = JSON.stringify({ model, id: question.id, type: question.type, prompt: question.prompt, points: question.points, rubric: question.scheme, modelAnswer: question.correctAnswer, outcomes: question.outcomeIds });
  return `ucc-grade-${createHash("sha256").update(stable).digest("hex").slice(0, 48)}`;
}

function stablePrompt(question: AssessmentQuestionRecord) {
  const max = Math.max(1, Number(question.points) || 1);
  return `You are grading one University of Cape Coast microcredential assessment response.\n\nGRADING RULES\n- Use only the approved question, model answer/key points and facilitator rubric below.\n- Do not create new criteria or alter the mark allocation.\n- Award a score from 0 to ${max}. Never award more than ${max}.\n- Apply the rubric consistently to every learner.\n- A missing or irrelevant response earns zero where the rubric supports that result.\n- Give concise criterion-based feedback and a practical next step.\n- Do not infer facts about the learner.\n\nQUESTION TYPE\n${question.type}\n\nAPPROVED QUESTION\n${String(question.prompt ?? "").trim()}\n\nMODEL ANSWER / KEY POINTS\n${String(question.correctAnswer ?? "").trim() || "No separate model answer supplied; rely strictly on the rubric."}\n\nFACILITATOR RUBRIC\n${String(question.scheme ?? "").trim()}\n\nMAXIMUM MARK\n${max}\n\nLEARNING OUTCOME IDS\n${(question.outcomeIds ?? []).join(", ") || "Not specified"}`;
}

export async function gradeQuestionWithAi(question: AssessmentQuestionRecord, answer: unknown, options?: { imageDataUrl?: string }): Promise<AiQuestionGrade> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured for automated rubric grading.");
  const model = modelFor(question, answer);
  const max = Math.max(1, Number(question.points) || 1);
  const learnerAnswer = typeof answer === "string" ? answer : JSON.stringify(answer ?? null);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    signal: AbortSignal.timeout(Math.min(180, Math.max(30, Number(process.env.ASSESSMENT_AI_TIMEOUT_SECONDS) || 90)) * 1000),
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      reasoning: { effort: "low" },
      instructions: "Apply the supplied university rubric exactly. Return only the structured grading result.",
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: stablePrompt(question), prompt_cache_breakpoint: { mode: "explicit" } },
          { type: "input_text", text: `LEARNER RESPONSE\n${learnerAnswer.slice(0, 80_000)}` },
          ...(options?.imageDataUrl ? [{ type: "input_image", image_url: options.imageDataUrl, detail: "auto" }] : []),
        ],
      }],
      prompt_cache_key: cacheKey(question, model),
      prompt_cache_options: { mode: "explicit", ttl: "30m" },
      max_output_tokens: 2500,
      text: { format: { type: "json_schema", name: "ucc_assessment_grade", strict: true, schema: responseSchema } },
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (payload as { error?: { message?: string } }).error?.message || "No provider details were returned.";
    throw new Error(`Automated assessment grading failed (${response.status}): ${message}`);
  }
  const text = outputText(payload);
  if (!text) throw new Error("Automated assessment grading returned no structured result.");
  let parsed: { score?: number; feedback?: string; learnerAdvice?: string; criteria?: AiCriterionFeedback[] };
  try { parsed = JSON.parse(text); } catch { throw new Error("Automated assessment grading returned invalid structured data."); }
  const earned = Math.min(max, Math.max(0, Number(parsed.score) || 0));
  const feedback = String(parsed.feedback ?? "").trim().slice(0, 4000);
  if (!feedback) throw new Error("Automated assessment grading returned a score without the required learner feedback.");
  const usage = (payload as { usage?: { input_tokens_details?: { cached_tokens?: number } } }).usage;
  return {
    questionId: question.id,
    model,
    earned,
    available: max,
    feedback,
    learnerAdvice: String(parsed.learnerAdvice ?? "").trim().slice(0, 2500),
    criteria: Array.isArray(parsed.criteria) ? parsed.criteria.slice(0, 30).map((criterion) => ({ criterion: String(criterion.criterion ?? "").slice(0, 300), score: Math.min(max, Math.max(0, Number(criterion.score) || 0)), maximum: Math.min(max, Math.max(0, Number(criterion.maximum) || 0)), feedback: String(criterion.feedback ?? "").slice(0, 1200) })) : [],
    cachedInputTokens: Number(usage?.input_tokens_details?.cached_tokens ?? 0),
  };
}

export async function gradeQuestionsWithAi(questions: AssessmentQuestionRecord[], answers: Record<string, unknown>) {
  const results: AiQuestionGrade[] = [];
  // Small worker pool: preserves prompt-cache reuse without creating an uncontrolled API burst.
  const queue = [...questions];
  const workers = Array.from({ length: Math.min(3, queue.length) }, async () => {
    while (queue.length) {
      const question = queue.shift();
      if (!question) break;
      results.push(await gradeQuestionWithAi(question, answers[question.id]));
    }
  });
  await Promise.all(workers);
  return results;
}

export async function gradeActivityEvidenceWithAi(input: {
  id: string;
  title: string;
  instructions: string;
  rubric: string;
  maxMark: number;
  gradingMode?: "ai_auto" | "ai_luna" | "ai_terra";
  evidence: unknown;
  imageDataUrl?: string;
}) {
  const question: AssessmentQuestionRecord = {
    id: input.id,
    type: "Practical assignment",
    prompt: `${input.title}\n\n${input.instructions}`,
    correctAnswer: "",
    points: Math.max(1, input.maxMark),
    scheme: input.rubric,
    gradingMode: input.gradingMode ?? "ai_auto",
    outcomeIds: [],
  };
  return gradeQuestionWithAi(question, input.evidence, { imageDataUrl: input.imageDataUrl });
}
