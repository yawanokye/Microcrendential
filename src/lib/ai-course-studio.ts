import { createSign } from "node:crypto";
import { z } from "zod";
import { defaultCourseDesign, normalizeCourseDesign, type CourseDesign } from "@/lib/course-design";

const COURSE_DISCIPLINES = [
  "Education",
  "Humanities & Social Sciences",
  "Business & Management",
  "Science",
  "Technology & Engineering",
  "Health Sciences",
  "Agriculture & Natural Resources",
  "Creative Arts & Design",
  "Interdisciplinary",
] as const;

const outcomeSchema = z.object({
  id: z.string().min(1).max(80),
  statement: z.string().min(10).max(600),
  skill: z.string().min(2).max(200),
  assessmentMethod: z.string().min(2).max(300),
});

const sectionSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(600),
});

const aiQuestionSchema = z.object({
  type: z.enum(["Multiple choice", "Short answer", "Scenario response"]),
  prompt: z.string().min(10).max(1000),
  options: z.array(z.string().max(400)).max(6),
  correctAnswer: z.string().max(1000),
  points: z.number().int().min(1).max(100),
  scheme: z.string().min(10).max(2000),
  feedbackCorrect: z.string().min(2).max(1000),
  feedbackIncorrect: z.string().min(2).max(1000),
  learnerAdvice: z.string().min(2).max(1000),
  outcomeIds: z.array(z.string().max(80)).min(1).max(6),
});

const learningBlockSchema = z.object({
  title: z.string().min(3).max(240),
  sectionId: z.string().min(1).max(80),
  contentMarkdown: z.string().min(80).max(20_000),
  estimatedMinutes: z.number().int().min(3).max(240),
  outcomeIds: z.array(z.string().max(80)).min(1).max(6),
});

const resourceSuggestionSchema = z.object({
  title: z.string().min(3).max(240),
  type: z.enum(["Watch", "Read"]),
  searchQuery: z.string().min(3).max(300),
  preferredSource: z.string().min(2).max(200),
  reason: z.string().min(10).max(800),
  licenceRequirement: z.string().min(3).max(500),
});

const activitySuggestionSchema = z.object({
  title: z.string().min(3).max(240),
  type: z.enum(["discussion", "case_study", "project", "reflection", "colab", "virtual_lab"]),
  instructions: z.string().min(20).max(3000),
  evidence: z.string().min(5).max(1000),
  required: z.boolean(),
  rubric: z.string().min(20).max(3000),
  outcomeIds: z.array(z.string().max(80)).min(1).max(6),
});

export const aiCourseSuggestionSchema = z.object({
  title: z.string().min(8).max(180),
  discipline: z.enum(COURSE_DISCIPLINES),
  description: z.string().min(80).max(1200),
  intendedAudience: z.string().min(20).max(2000),
  prerequisites: z.string().min(10).max(2000),
  accessibilityStatement: z.string().min(20).max(2000),
  objectives: z.array(z.string().min(10).max(600)).min(2).max(8),
  outcomes: z.array(outcomeSchema).min(2).max(10),
  skills: z.array(z.string().min(2).max(160)).min(1).max(20),
  sections: z.array(sectionSchema).min(1).max(12),
  learningBlocks: z.array(learningBlockSchema).min(2).max(24),
  resourceSuggestions: z.array(resourceSuggestionSchema).min(2).max(12),
  activitySuggestions: z.array(activitySuggestionSchema).min(1).max(12),
  assessmentQuestions: z.array(aiQuestionSchema).min(1).max(12),
  rationale: z.string().min(20).max(1500),
});

export type AiCourseSuggestion = z.infer<typeof aiCourseSuggestionSchema>;

const mediaChapterSchema = z.object({
  title: z.string().min(2).max(200),
  startTime: z.string().min(4).max(20),
  endTime: z.string().min(4).max(20),
  summary: z.string().min(10).max(1000),
});

export const aiMediaAnalysisSchema = z.object({
  title: z.string().min(2).max(200),
  language: z.string().min(2).max(80),
  summary: z.string().min(20).max(3000),
  transcript: z.string().min(20).max(200_000),
  chapters: z.array(mediaChapterSchema).min(1).max(30),
  objectives: z.array(z.string().min(10).max(600)).min(1).max(8),
  assessmentQuestions: z.array(aiQuestionSchema).min(1).max(10),
  accessibilityNotes: z.array(z.string().min(2).max(500)).max(12),
});

export type AiMediaAnalysis = z.infer<typeof aiMediaAnalysisSchema>;
export type AiWorkload = "fast" | "balanced" | "quality";

const jsonSchema = {
  course: {
    type: "object",
    additionalProperties: false,
    required: ["title", "discipline", "description", "intendedAudience", "prerequisites", "accessibilityStatement", "objectives", "outcomes", "skills", "sections", "learningBlocks", "resourceSuggestions", "activitySuggestions", "assessmentQuestions", "rationale"],
    properties: {
      title: { type: "string" },
      discipline: { type: "string", enum: COURSE_DISCIPLINES },
      description: { type: "string" },
      intendedAudience: { type: "string" },
      prerequisites: { type: "string" },
      accessibilityStatement: { type: "string" },
      objectives: { type: "array", items: { type: "string" } },
      outcomes: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "statement", "skill", "assessmentMethod"], properties: { id: { type: "string" }, statement: { type: "string" }, skill: { type: "string" }, assessmentMethod: { type: "string" } } } },
      skills: { type: "array", items: { type: "string" } },
      sections: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "title", "description"], properties: { id: { type: "string" }, title: { type: "string" }, description: { type: "string" } } } },
      learningBlocks: { type: "array", items: { type: "object", additionalProperties: false, required: ["title", "sectionId", "contentMarkdown", "estimatedMinutes", "outcomeIds"], properties: { title: { type: "string" }, sectionId: { type: "string" }, contentMarkdown: { type: "string" }, estimatedMinutes: { type: "integer" }, outcomeIds: { type: "array", items: { type: "string" } } } } },
      resourceSuggestions: { type: "array", items: { type: "object", additionalProperties: false, required: ["title", "type", "searchQuery", "preferredSource", "reason", "licenceRequirement"], properties: { title: { type: "string" }, type: { type: "string", enum: ["Watch", "Read"] }, searchQuery: { type: "string" }, preferredSource: { type: "string" }, reason: { type: "string" }, licenceRequirement: { type: "string" } } } },
      activitySuggestions: { type: "array", items: { type: "object", additionalProperties: false, required: ["title", "type", "instructions", "evidence", "required", "rubric", "outcomeIds"], properties: { title: { type: "string" }, type: { type: "string", enum: ["discussion", "case_study", "project", "reflection", "colab", "virtual_lab"] }, instructions: { type: "string" }, evidence: { type: "string" }, required: { type: "boolean" }, rubric: { type: "string" }, outcomeIds: { type: "array", items: { type: "string" } } } } },
      assessmentQuestions: { type: "array", items: { type: "object", additionalProperties: false, required: ["type", "prompt", "options", "correctAnswer", "points", "scheme", "feedbackCorrect", "feedbackIncorrect", "learnerAdvice", "outcomeIds"], properties: { type: { type: "string", enum: ["Multiple choice", "Short answer", "Scenario response"] }, prompt: { type: "string" }, options: { type: "array", items: { type: "string" } }, correctAnswer: { type: "string" }, points: { type: "integer" }, scheme: { type: "string" }, feedbackCorrect: { type: "string" }, feedbackIncorrect: { type: "string" }, learnerAdvice: { type: "string" }, outcomeIds: { type: "array", items: { type: "string" } } } } },
      rationale: { type: "string" },
    },
  },
  media: {
    type: "object",
    additionalProperties: false,
    required: ["title", "language", "summary", "transcript", "chapters", "objectives", "assessmentQuestions", "accessibilityNotes"],
    properties: {
      title: { type: "string" },
      language: { type: "string" },
      summary: { type: "string" },
      transcript: { type: "string" },
      chapters: { type: "array", items: { type: "object", additionalProperties: false, required: ["title", "startTime", "endTime", "summary"], properties: { title: { type: "string" }, startTime: { type: "string" }, endTime: { type: "string" }, summary: { type: "string" } } } },
      objectives: { type: "array", items: { type: "string" } },
      assessmentQuestions: { type: "array", items: { type: "object", additionalProperties: false, required: ["type", "prompt", "options", "correctAnswer", "points", "scheme", "feedbackCorrect", "feedbackIncorrect", "learnerAdvice", "outcomeIds"], properties: { type: { type: "string", enum: ["Multiple choice", "Short answer", "Scenario response"] }, prompt: { type: "string" }, options: { type: "array", items: { type: "string" } }, correctAnswer: { type: "string" }, points: { type: "integer" }, scheme: { type: "string" }, feedbackCorrect: { type: "string" }, feedbackIncorrect: { type: "string" }, learnerAdvice: { type: "string" }, outcomeIds: { type: "array", items: { type: "string" } } } } },
      accessibilityNotes: { type: "array", items: { type: "string" } },
    },
  },
} as const;

function parseJsonText(value: string) {
  const cleaned = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(cleaned) as unknown;
}

function openAiOutputText(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const response = value as { output_text?: string; output?: { content?: { type?: string; text?: string }[] }[] };
  if (response.output_text) return response.output_text;
  return response.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text ?? "";
}

function boundedSource(text?: string) {
  if (!text) return "";
  const clean = text.replace(/\u0000/g, " ").trim();
  if (clean.length <= 180_000) return clean;
  const part = 60_000;
  return `${clean.slice(0, part)}\n\n[Middle excerpt]\n${clean.slice(Math.floor(clean.length / 2) - part / 2, Math.floor(clean.length / 2) + part / 2)}\n\n[Final excerpt]\n${clean.slice(-part)}`;
}

export function getAiIntegrationStatus() {
  const legacyBalancedModel = process.env.OPENAI_COURSE_MODEL?.trim();
  const openAiModels = {
    fast: (process.env.OPENAI_FAST_MODEL || "gpt-5.6-luna").trim(),
    balanced: (process.env.OPENAI_BALANCED_MODEL || legacyBalancedModel || "gpt-5.6-terra").trim(),
    quality: (process.env.OPENAI_QUALITY_MODEL || "gpt-5.6-sol").trim(),
  };
  const vertexModel = (process.env.GOOGLE_VERTEX_MODEL || "gemini-3.8-flash").trim();
  const vertexCredentials = Boolean(process.env.GOOGLE_CLOUD_ACCESS_TOKEN || process.env.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON_BASE64);
  return {
    openai: {
      configured: Boolean(process.env.OPENAI_API_KEY),
      model: openAiModels.balanced,
      models: openAiModels,
      routing: {
        fast: "Quick drafting and field refinement",
        balanced: "Full course generation and manual conversion",
        quality: "Rigorous academic and assessment review",
      },
      purpose: "Routed course design and assessment",
    },
    vertex: { configured: Boolean(process.env.GOOGLE_CLOUD_PROJECT && vertexCredentials), model: vertexModel, purpose: "Video and audio understanding" },
    humanApprovalRequired: true,
  };
}

export async function generateCourseDesignSuggestion(input: {
  title?: string;
  discipline?: string;
  description?: string;
  design?: Partial<CourseDesign>;
  questionCount?: number;
  sourceText?: string;
  instruction?: string;
  workload?: AiWorkload;
}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OpenAI is not configured. Add OPENAI_API_KEY in the server environment.");
  const status = getAiIntegrationStatus();
  const workload = input.workload ?? "balanced";
  const model = status.openai.models[workload];
  const currentDesign = normalizeCourseDesign(input.design ?? defaultCourseDesign());
  const payload = {
    currentCourse: { title: input.title ?? "", discipline: input.discipline ?? "Interdisciplinary", description: input.description ?? "", design: currentDesign, existingQuestionCount: input.questionCount ?? 0 },
    facilitatorInstruction: input.instruction?.trim() || "Improve the course for clarity, measurable alignment, inclusive delivery and authentic assessment.",
    sourceMaterial: boundedSource(input.sourceText),
  };
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      instructions: "You are an expert university instructional designer. Produce an editable course-design recommendation grounded only in the supplied course and source material. Use observable outcome verbs and align every lesson, activity and question to valid outcome IDs. Draft concise but substantive learning blocks in Markdown. Recommend resource search queries and preferred reputable sources, never fabricated URLs or unverified licence claims. Suggest authentic activities with assessable evidence and rubrics. Do not invent accreditation, ownership, citations, fees or institutional approval. Preserve open self-enrolment and zero fees because those are platform defaults. All output is a draft for facilitator and academic review.",
      input: JSON.stringify(payload),
      text: { format: { type: "json_schema", name: "ucc_course_design_suggestion", strict: true, schema: jsonSchema.course } },
    }),
    signal: AbortSignal.timeout(120_000),
  });
  const result = await response.json().catch(() => ({})) as { error?: { message?: string } };
  if (!response.ok) throw new Error(result.error?.message || `OpenAI returned HTTP ${response.status}.`);
  const output = openAiOutputText(result);
  if (!output) throw new Error("OpenAI returned no structured course design.");
  return { suggestion: aiCourseSuggestionSchema.parse(parseJsonText(output)), model, workload };
}

type VertexServiceAccount = { client_email: string; private_key: string; token_uri?: string };
type CachedVertexToken = { value: string; expiresAt: number };
const vertexTokenCache = globalThis as typeof globalThis & { __uccVertexToken?: CachedVertexToken };

function serviceAccountFromEnvironment(): VertexServiceAccount | null {
  const encoded = process.env.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON_BASE64?.trim();
  const raw = encoded ? Buffer.from(encoded, "base64").toString("utf8") : process.env.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  const parsed = JSON.parse(raw) as Partial<VertexServiceAccount>;
  if (!parsed.client_email || !parsed.private_key) throw new Error("The Vertex AI service-account JSON is incomplete.");
  return parsed as VertexServiceAccount;
}

function base64Url(value: string) {
  return Buffer.from(value).toString("base64url");
}

async function vertexAccessToken() {
  const direct = process.env.GOOGLE_CLOUD_ACCESS_TOKEN?.trim();
  if (direct) return direct;
  if (vertexTokenCache.__uccVertexToken && vertexTokenCache.__uccVertexToken.expiresAt > Date.now() + 60_000) return vertexTokenCache.__uccVertexToken.value;
  const account = serviceAccountFromEnvironment();
  if (!account) throw new Error("Vertex AI credentials are not configured.");
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64Url(JSON.stringify({ iss: account.client_email, scope: "https://www.googleapis.com/auth/cloud-platform", aud: account.token_uri || "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }))}`;
  const signature = createSign("RSA-SHA256").update(unsigned).end().sign(account.private_key, "base64url");
  const tokenResponse = await fetch(account.token_uri || "https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` }), signal: AbortSignal.timeout(30_000) });
  const tokenResult = await tokenResponse.json().catch(() => ({})) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!tokenResponse.ok || !tokenResult.access_token) throw new Error(tokenResult.error_description || "Google could not issue a Vertex AI access token.");
  vertexTokenCache.__uccVertexToken = { value: tokenResult.access_token, expiresAt: Date.now() + (tokenResult.expires_in ?? 3600) * 1000 };
  return tokenResult.access_token;
}

export function validateVertexMediaSource(sourceUrl: string) {
  if (sourceUrl.startsWith("gs://")) return sourceUrl;
  const url = new URL(sourceUrl);
  if (url.protocol !== "https:" || !["youtube.com", "www.youtube.com", "youtu.be", "m.youtube.com"].includes(url.hostname.toLowerCase())) throw new Error("Use a public YouTube URL or an authorised gs:// Cloud Storage URI.");
  return url.toString();
}

export async function analyseMediaWithVertex(input: { sourceUrl: string; mimeType?: string; instruction?: string; outcomeIds?: string[] }) {
  const status = getAiIntegrationStatus();
  if (!status.vertex.configured) throw new Error("Vertex AI is not configured. Add the Google Cloud project and service-account credentials.");
  const project = process.env.GOOGLE_CLOUD_PROJECT!.trim();
  const location = (process.env.GOOGLE_CLOUD_LOCATION || "global").trim();
  const host = location === "global" ? "aiplatform.googleapis.com" : `${location}-aiplatform.googleapis.com`;
  const sourceUrl = validateVertexMediaSource(input.sourceUrl.trim());
  const token = await vertexAccessToken();
  const prompt = [
    "Analyse this university learning video or audio source. Produce a faithful timestamped transcript, meaningful chapters, a concise learning summary, possible objectives, accessible-delivery notes, and assessment questions grounded only in the media.",
    "Do not claim that the content is accurate, licensed, approved or accessible; flag matters the facilitator must verify.",
    input.outcomeIds?.length ? `Use these existing outcome IDs when applicable: ${input.outcomeIds.join(", ")}.` : "Use outcome-1, outcome-2 and so on for proposed alignments.",
    input.instruction?.trim() || "Focus on learning value and authentic assessment evidence.",
  ].join("\n");
  const response = await fetch(`https://${host}/v1/projects/${encodeURIComponent(project)}/locations/${encodeURIComponent(location)}/publishers/google/models/${encodeURIComponent(status.vertex.model)}:generateContent`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ fileData: { fileUri: sourceUrl, mimeType: input.mimeType || "video/mp4" } }, { text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 32_768, responseMimeType: "application/json", responseSchema: jsonSchema.media, mediaResolution: "MEDIA_RESOLUTION_MEDIUM" },
    }),
    signal: AbortSignal.timeout(180_000),
  });
  const result = await response.json().catch(() => ({})) as { error?: { message?: string }; candidates?: { content?: { parts?: { text?: string }[] } }[] };
  if (!response.ok) throw new Error(result.error?.message || `Vertex AI returned HTTP ${response.status}.`);
  const output = result.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
  if (!output) throw new Error("Gemini returned no structured media analysis.");
  return { analysis: aiMediaAnalysisSchema.parse(parseJsonText(output)), model: status.vertex.model };
}
