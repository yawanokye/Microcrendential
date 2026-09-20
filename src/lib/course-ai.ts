import { createSign } from "node:crypto";
import { defaultCourseDesign, type CourseDesign, type CourseMaterialRecord, type LearningOutcome } from "@/lib/course-design";
import { sanitizeReadableHtml, textToReadableHtml } from "@/lib/document-content";

export type CourseAiProvider = "auto" | "openai" | "vertex";
export type CourseAiMode = "idea" | "manual" | "media" | "improve";

type RawOutcome = { statement: string; skill: string; assessmentMethod: string };
type RawSection = {
  title: string;
  description: string;
  lessonHtml: string;
  estimatedMinutes: number;
  activityTitle: string;
  activityInstructions: string;
  videoSearchQuery: string;
  openResourceQuery: string;
};
type RawQuestion = {
  type: "Multiple choice" | "Short answer" | "Scenario response";
  prompt: string;
  options: string[];
  correctAnswer: string;
  points: number;
  scheme: string;
  feedbackCorrect: string;
  feedbackIncorrect: string;
  learnerAdvice: string;
  outcomeIndexes: number[];
};
type RawPlan = {
  title: string;
  discipline: string;
  description: string;
  intendedAudience: string;
  prerequisites: string;
  accessibilityStatement: string;
  category: "credit" | "professional" | "rpl";
  deliveryPattern: "asynchronous" | "synchronous" | "blended";
  level: "foundation" | "applied" | "advanced";
  language: string;
  expectedHours: number;
  objectives: string[];
  skills: string[];
  outcomes: RawOutcome[];
  sections: RawSection[];
  assessmentQuestions: RawQuestion[];
  warnings: string[];
};

export type CourseAiProposal = {
  id: string;
  provider: "openai" | "vertex";
  model: string;
  mode: CourseAiMode;
  draft: {
    title: string;
    code: string;
    discipline: string;
    description: string;
    design: CourseDesign;
    materials: CourseMaterialRecord[];
    activities: never[];
    assessmentModes: string[];
    assessmentConfig: { passMark: number; attempts: string; questions: Array<Record<string, unknown>>; questionFiles: never[] };
    gateRequired: boolean;
    questionLimit: number;
    certificateEnabled: boolean;
  };
  sectionSuggestions: Array<{ sectionId: string; sectionTitle: string; activityTitle: string; activitySummary: string; youtubeSearchUrl: string; openResourceQuery: string }>;
  warnings: string[];
};

type SourceFile = { key: string; name: string; mimeType: string };
type GenerateInput = {
  mode: CourseAiMode;
  provider: CourseAiProvider;
  sourceText: string;
  sectionCount: number;
  preferredTitle?: string;
  preferredDiscipline?: string;
  sourceFile?: SourceFile;
  media?: { mimeType: string; dataBase64?: string; publicUrl?: string; name?: string };
};

const rawPlanSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "discipline", "description", "intendedAudience", "prerequisites", "accessibilityStatement", "category", "deliveryPattern", "level", "language", "expectedHours", "objectives", "skills", "outcomes", "sections", "assessmentQuestions", "warnings"],
  properties: {
    title: { type: "string" }, discipline: { type: "string" }, description: { type: "string" }, intendedAudience: { type: "string" }, prerequisites: { type: "string" }, accessibilityStatement: { type: "string" },
    category: { type: "string", enum: ["credit", "professional", "rpl"] }, deliveryPattern: { type: "string", enum: ["asynchronous", "synchronous", "blended"] }, level: { type: "string", enum: ["foundation", "applied", "advanced"] }, language: { type: "string" }, expectedHours: { type: "number" },
    objectives: { type: "array", items: { type: "string" } }, skills: { type: "array", items: { type: "string" } },
    outcomes: { type: "array", items: { type: "object", additionalProperties: false, required: ["statement", "skill", "assessmentMethod"], properties: { statement: { type: "string" }, skill: { type: "string" }, assessmentMethod: { type: "string" } } } },
    sections: { type: "array", items: { type: "object", additionalProperties: false, required: ["title", "description", "lessonHtml", "estimatedMinutes", "activityTitle", "activityInstructions", "videoSearchQuery", "openResourceQuery"], properties: { title: { type: "string" }, description: { type: "string" }, lessonHtml: { type: "string" }, estimatedMinutes: { type: "number" }, activityTitle: { type: "string" }, activityInstructions: { type: "string" }, videoSearchQuery: { type: "string" }, openResourceQuery: { type: "string" } } } },
    assessmentQuestions: { type: "array", items: { type: "object", additionalProperties: false, required: ["type", "prompt", "options", "correctAnswer", "points", "scheme", "feedbackCorrect", "feedbackIncorrect", "learnerAdvice", "outcomeIndexes"], properties: { type: { type: "string", enum: ["Multiple choice", "Short answer", "Scenario response"] }, prompt: { type: "string" }, options: { type: "array", items: { type: "string" } }, correctAnswer: { type: "string" }, points: { type: "number" }, scheme: { type: "string" }, feedbackCorrect: { type: "string" }, feedbackIncorrect: { type: "string" }, learnerAdvice: { type: "string" }, outcomeIndexes: { type: "array", items: { type: "integer" } } } } },
    warnings: { type: "array", items: { type: "string" } },
  },
} as const;

const trim = (value: unknown, maximum: number) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maximum);
const list = (value: unknown, maximum: number, itemMaximum = 500) => Array.isArray(value) ? value.map((item) => trim(item, itemMaximum)).filter(Boolean).slice(0, maximum) : [];
const clamp = (value: unknown, minimum: number, maximum: number, fallback: number) => Math.min(maximum, Math.max(minimum, Number(value) || fallback));
const configured = (value: string | undefined) => Boolean(value?.trim());
const aiTimeoutSeconds = () => clamp(process.env.COURSE_AI_TIMEOUT_SECONDS, 45, 180, 120);

export function courseAiStatus() {
  const openai = configured(process.env.OPENAI_API_KEY);
  const vertex = configured(process.env.GOOGLE_CLOUD_PROJECT) && configured(process.env.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON_BASE64 || process.env.GOOGLE_VERTEX_SERVICE_ACCOUNT_BASE64 || process.env.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS);
  return {
    available: openai || vertex,
    defaultProvider: (process.env.COURSE_AI_PROVIDER || "auto").toLowerCase(),
    timeoutSeconds: aiTimeoutSeconds(),
    providers: [
      { id: "openai", label: "OpenAI", configured: openai, model: process.env.OPENAI_COURSE_MODEL || "gpt-5-mini", use: "Course structure, lessons, activities and assessment design" },
      { id: "vertex", label: "Google Vertex AI", configured: vertex, model: process.env.GOOGLE_VERTEX_MODEL || "gemini-2.5-flash", use: "Text, documents, public YouTube, audio and video analysis" },
    ],
  };
}

function promptFor(input: GenerateInput) {
  const sourceLabel = input.mode === "idea" ? "course synopsis or idea" : input.mode === "manual" ? "uploaded learning manual" : input.mode === "media" ? "video or audio source" : "current course draft";
  return `Design an academically credible, practical microcredential from the ${sourceLabel} below.

Return exactly ${input.sectionCount} ordered course sections. Each section must contain a concise, original HTML learning lesson of roughly 250–450 words using only h2, h3, p, ul, ol, li, strong, em, blockquote and table elements. Do not include scripts, styles, iframes, images or invented quotations. Also propose one authentic learner activity, one YouTube search query, and one open-resource search query per section. Create 3–8 measurable outcomes and 4–10 assessment questions. Multiple-choice questions need 4 credible options and one exact correct answer. Short and scenario responses need a clear marking scheme. Keep estimatedMinutes for each section between 5 and 240 and return no more than 12 questions.

Do not invent specific video URLs, article URLs, licences, institutional approval, named experts, statistics or citations. Search queries are recommendations for facilitator review, not approved resources. The facilitator must approve every generated field before it becomes a draft.

Preferred title: ${trim(input.preferredTitle, 240) || "derive a precise title"}
Preferred discipline: ${trim(input.preferredDiscipline, 160) || "derive the most suitable discipline"}
Source:
${input.sourceText.slice(0, 90_000)}`;
}

function responseTextFromOpenAi(payload: unknown) {
  const data = payload as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  return data.output_text || data.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text || "";
}

async function callOpenAi(input: GenerateInput) {
  if (input.mode === "media") throw new Error("OpenAI is not configured for direct audio/video analysis in this Course Studio. Choose Google Vertex AI for media.");
  const apiKey = process.env.OPENAI_API_KEY?.trim(); if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");
  const model = process.env.OPENAI_COURSE_MODEL?.trim() || "gpt-5-mini";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST", signal: AbortSignal.timeout(aiTimeoutSeconds() * 1000),
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ model, instructions: "You are an expert university instructional designer. Produce valid JSON that follows the supplied schema and never claim academic approval.", input: promptFor(input), max_output_tokens: 12_000, text: { format: { type: "json_schema", name: "course_design", strict: true, schema: rawPlanSchema } } }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`OpenAI request failed (${response.status}): ${trim((payload as { error?: { message?: string } }).error?.message, 500) || "No response details were supplied."}`);
  const text = responseTextFromOpenAi(payload); if (!text) throw new Error("OpenAI returned no course-design content.");
  return { plan: JSON.parse(text) as RawPlan, provider: "openai" as const, model };
}

type ServiceAccount = { client_email: string; private_key: string; token_uri?: string; project_id?: string };
let cachedVertexToken: { value: string; expiresAt: number } | null = null;

function parseServiceAccount(): ServiceAccount {
  let raw = process.env.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON?.trim() || "";
  const encoded = process.env.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON_BASE64?.trim() || process.env.GOOGLE_VERTEX_SERVICE_ACCOUNT_BASE64?.trim();
  if (!raw && encoded) {
    try { raw = Buffer.from(encoded, "base64").toString("utf8"); }
    catch { throw new Error("The Vertex service-account value is not valid base64."); }
  }
  if (!raw && process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS file loading is not available in this deployment. Use GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON_BASE64 or GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON.");
  }
  try {
    const account = JSON.parse(raw) as ServiceAccount;
    if (!account.client_email || !account.private_key) throw new Error();
    return account;
  } catch { throw new Error("The Vertex service-account value is incomplete or is not valid JSON."); }
}

const base64Url = (value: string | Buffer) => Buffer.from(value).toString("base64url");

async function vertexAccessToken() {
  if (cachedVertexToken && cachedVertexToken.expiresAt > Date.now() + 60_000) return cachedVertexToken.value;
  const account = parseServiceAccount(); const now = Math.floor(Date.now() / 1000); const tokenUri = account.token_uri || "https://oauth2.googleapis.com/token";
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(JSON.stringify({ iss: account.client_email, scope: "https://www.googleapis.com/auth/cloud-platform", aud: tokenUri, iat: now, exp: now + 3600 }));
  const unsigned = `${header}.${claims}`; const signer = createSign("RSA-SHA256"); signer.update(unsigned); signer.end();
  const assertion = `${unsigned}.${base64Url(signer.sign(account.private_key.replace(/\\n/g, "\n")))}`;
  const response = await fetch(tokenUri, { method: "POST", signal: AbortSignal.timeout(15_000), headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }) });
  const payload = await response.json().catch(() => ({})) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!response.ok || !payload.access_token) throw new Error(`Vertex authentication failed (${response.status}): ${trim(payload.error_description, 400) || "Check the service-account key and IAM role."}`);
  cachedVertexToken = { value: payload.access_token, expiresAt: Date.now() + (payload.expires_in || 3600) * 1000 }; return payload.access_token;
}

async function callVertex(input: GenerateInput) {
  const project = process.env.GOOGLE_CLOUD_PROJECT?.trim(); if (!project) throw new Error("GOOGLE_CLOUD_PROJECT is not configured.");
  const location = process.env.GOOGLE_CLOUD_LOCATION?.trim() || "global"; const model = process.env.GOOGLE_VERTEX_MODEL?.trim() || "gemini-2.5-flash";
  const token = await vertexAccessToken(); const host = location === "global" ? "aiplatform.googleapis.com" : `${location}-aiplatform.googleapis.com`;
  const endpoint = `https://${host}/v1/projects/${encodeURIComponent(project)}/locations/${encodeURIComponent(location)}/publishers/google/models/${encodeURIComponent(model)}:generateContent`;
  const parts: Array<Record<string, unknown>> = [{ text: promptFor(input) }];
  if (input.media?.dataBase64) parts.push({ inlineData: { mimeType: input.media.mimeType, data: input.media.dataBase64 } });
  if (input.media?.publicUrl) parts.push({ fileData: { mimeType: input.media.mimeType, fileUri: input.media.publicUrl } });
  const response = await fetch(endpoint, {
    method: "POST", signal: AbortSignal.timeout(aiTimeoutSeconds() * 1000), headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: "You are an expert university instructional designer. Return valid JSON only and never claim academic approval." }] }, contents: [{ role: "user", parts }], generationConfig: { temperature: 0.2, maxOutputTokens: 12_000, responseMimeType: "application/json", responseSchema: rawPlanSchema } }),
  });
  const payload = await response.json().catch(() => ({})) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; error?: { message?: string } };
  if (!response.ok) throw new Error(`Vertex AI request failed (${response.status}): ${trim(payload.error?.message, 500) || "No response details were supplied."}`);
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim() || "";
  if (!text) throw new Error("Vertex AI returned no course-design content.");
  return { plan: JSON.parse(text) as RawPlan, provider: "vertex" as const, model };
}

function youtubeEmbed(value: string) {
  try { const url = new URL(value); const host = url.hostname.toLowerCase().replace(/^www\./, ""); let id = ""; if (host === "youtu.be") id = url.pathname.split("/").filter(Boolean)[0] || ""; if (host.endsWith("youtube.com")) id = url.searchParams.get("v") || url.pathname.match(/\/(?:embed|shorts)\/([\w-]{6,})/)?.[1] || ""; return /^[\w-]{6,20}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : undefined; } catch { return undefined; }
}

function normalizePlan(result: Awaited<ReturnType<typeof callOpenAi> | ReturnType<typeof callVertex>>, input: GenerateInput): CourseAiProposal {
  const raw = result.plan; const fallback = defaultCourseDesign();
  const rawOutcomes = Array.isArray(raw.outcomes) ? raw.outcomes.slice(0, 8) : [];
  const outcomes: LearningOutcome[] = rawOutcomes.map((outcome, index) => ({ id: `ai-outcome-${index + 1}`, statement: trim(outcome.statement, 600), skill: trim(outcome.skill, 200) || "Applied problem-solving", assessmentMethod: trim(outcome.assessmentMethod, 300) || "Applied assignment or practical evidence" })).filter((outcome) => outcome.statement.length >= 10);
  if (outcomes.length < 2) outcomes.push(...fallback.outcomes.slice(outcomes.length).map((outcome, index) => ({ ...outcome, id: `ai-outcome-${outcomes.length + index + 1}` })));
  const rawSections = Array.isArray(raw.sections) ? raw.sections.slice(0, input.sectionCount) : [];
  while (rawSections.length < input.sectionCount) rawSections.push({ title: `Section ${rawSections.length + 1}`, description: "Facilitator review and additional content are required.", lessonHtml: "<h2>Section under development</h2><p>Use the section workspace to add the approved learning material.</p>", estimatedMinutes: 10, activityTitle: "Guided application", activityInstructions: "Apply the section concepts to a relevant example and record your reasoning.", videoSearchQuery: trim(raw.title, 120), openResourceQuery: trim(raw.title, 120) });
  const sections = rawSections.map((section, index) => ({ id: `ai-section-${index + 1}`, title: trim(section.title, 200) || `Section ${index + 1}`, description: trim(section.description, 600) || "Review the learning purpose for this section." }));
  const design: CourseDesign = {
    ...fallback,
    category: ["credit", "professional", "rpl"].includes(raw.category) ? raw.category : "professional",
    deliveryPattern: ["asynchronous", "synchronous", "blended"].includes(raw.deliveryPattern) ? raw.deliveryPattern : "asynchronous",
    level: ["foundation", "applied", "advanced"].includes(raw.level) ? raw.level : "applied",
    language: trim(raw.language, 80) || "English", expectedHours: clamp(raw.expectedHours, 1, 500, Math.max(4, sections.length * 2)), enrolmentMode: "open", priceGhs: 0, certificateFeeGhs: 0, creditValue: 0,
    intendedAudience: trim(raw.intendedAudience, 2000) || fallback.intendedAudience, prerequisites: trim(raw.prerequisites, 2000) || fallback.prerequisites, accessibilityStatement: trim(raw.accessibilityStatement, 2000) || fallback.accessibilityStatement,
    objectives: list(raw.objectives, 8, 600).length >= 2 ? list(raw.objectives, 8, 600) : fallback.objectives, outcomes, skills: list(raw.skills, 20, 200).length ? list(raw.skills, 20, 200) : [...new Set(outcomes.map((outcome) => outcome.skill))], sections,
  };
  const materials: CourseMaterialRecord[] = [];
  if (input.mode === "media" && input.sourceFile) materials.push({ id: "ai-source-media", title: trim(input.sourceFile.name.replace(/\.[^.]+$/, ""), 240) || "Original media", kind: "Watch", source: "Facilitator-supplied media", fileKey: input.sourceFile.key, fileName: input.sourceFile.name, mimeType: input.sourceFile.mimeType, sectionId: sections[0].id, sectionTitle: sections[0].title, unitTitle: "Original media", estimatedMinutes: 15, outcomeIds: [outcomes[0].id], accessibilityChecked: false, required: true, license: "Rights, transcript and accessibility require facilitator review" });
  if (input.mode === "media" && input.media?.publicUrl) { const embed = youtubeEmbed(input.media.publicUrl); if (embed) materials.push({ id: "ai-source-youtube", title: trim(raw.title, 240) || "Source video", kind: "Watch", source: "YouTube", url: embed, externalUrl: input.media.publicUrl, sectionId: sections[0].id, sectionTitle: sections[0].title, unitTitle: "Source video", estimatedMinutes: 15, outcomeIds: [outcomes[0].id], accessibilityChecked: false, required: true, license: "YouTube terms; transcript and accessibility require facilitator review" }); }
  rawSections.forEach((section, index) => {
    const sectionRecord = sections[index]; const outcomeIds = [outcomes[index % outcomes.length]?.id, outcomes[(index + 1) % outcomes.length]?.id].filter((id): id is string => Boolean(id));
    const lessonHtml = sanitizeReadableHtml(String(section.lessonHtml || "")) || textToReadableHtml(section.description || sectionRecord.description);
    materials.push({ id: `ai-lesson-${index + 1}`, title: sectionRecord.title, kind: "Read", source: `AI-assisted draft · ${result.provider === "openai" ? "OpenAI" : "Google Vertex AI"}`, readableHtml: lessonHtml, plainText: lessonHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(), sectionId: sectionRecord.id, sectionTitle: sectionRecord.title, unitTitle: `Learning unit ${index + 1}`, estimatedMinutes: clamp(section.estimatedMinutes, 5, 240, 20), outcomeIds, accessibilityChecked: false, required: true, license: "AI-assisted course-authored draft; facilitator must verify accuracy, rights and accessibility", ...(input.mode === "manual" && input.sourceFile ? { fileKey: input.sourceFile.key, fileName: input.sourceFile.name, mimeType: input.sourceFile.mimeType } : {}) });
    if (trim(section.activityInstructions, 2000)) materials.push({ id: `ai-activity-${index + 1}`, title: trim(section.activityTitle, 240) || `Apply ${sectionRecord.title}`, kind: "Activity", source: "AI-assisted activity draft", readableHtml: textToReadableHtml(`## Activity\n${trim(section.activityInstructions, 2000)}`), plainText: trim(section.activityInstructions, 2000), sectionId: sectionRecord.id, sectionTitle: sectionRecord.title, unitTitle: "Guided learning activity", estimatedMinutes: 20, outcomeIds, accessibilityChecked: false, required: true, license: "Course-authored activity draft; facilitator review required" });
  });
  const questions = (Array.isArray(raw.assessmentQuestions) ? raw.assessmentQuestions : []).slice(0, 12).map((question, index) => {
    const options = list(question.options, 6, 300); const outcomeIds = (Array.isArray(question.outcomeIndexes) ? question.outcomeIndexes : []).map((position) => outcomes[Math.max(0, Math.min(outcomes.length - 1, Number(position) || 0))]?.id).filter((id): id is string => Boolean(id));
    const requestedAnswer = trim(question.correctAnswer, 1000);
    const correctAnswer = question.type === "Multiple choice" && options.length > 0 && !options.includes(requestedAnswer)
      ? options[0]
      : requestedAnswer;
    return { id: `ai-question-${index + 1}`, type: question.type || "Short answer", prompt: trim(question.prompt, 2000), options, correctAnswer, points: clamp(question.points, 1, 20, 1), scheme: trim(question.scheme, 3000) || "Award marks for accurate explanation, application and evidence.", feedbackCorrect: trim(question.feedbackCorrect, 1000) || "The response demonstrates the intended outcome.", feedbackIncorrect: trim(question.feedbackIncorrect, 1000) || "Review the relevant lesson and try again.", learnerAdvice: trim(question.learnerAdvice, 1000) || "Use the lesson concepts and explain your reasoning.", outcomeIds: outcomeIds.length ? outcomeIds : [outcomes[index % outcomes.length].id] };
  }).filter((question) => question.prompt.length >= 10);
  const sectionSuggestions = rawSections.map((section, index) => ({ sectionId: sections[index].id, sectionTitle: sections[index].title, activityTitle: trim(section.activityTitle, 240) || "Guided application", activitySummary: trim(section.activityInstructions, 1000), youtubeSearchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(trim(section.videoSearchQuery, 300) || sections[index].title)}`, openResourceQuery: trim(section.openResourceQuery, 300) || sections[index].title }));
  const title = trim(raw.title, 240) || trim(input.preferredTitle, 240) || "AI-assisted microcredential";
  return { id: crypto.randomUUID(), provider: result.provider, model: result.model, mode: input.mode, draft: { title, code: `UCC-AI-${String(Date.now()).slice(-6)}`, discipline: trim(raw.discipline, 160) || trim(input.preferredDiscipline, 160) || "Interdisciplinary", description: trim(raw.description, 5000), design, materials, activities: [], assessmentModes: ["Objective quiz", "Applied assignment"], assessmentConfig: { passMark: 60, attempts: "2", questions, questionFiles: [] }, gateRequired: true, questionLimit: Math.max(1, questions.length), certificateEnabled: true }, sectionSuggestions, warnings: [...list(raw.warnings, 8, 500), "AI output is an editable proposal, not an approved course. Verify accuracy, copyright, accessibility, links, assessment answers and academic alignment before applying it." ] };
}

export async function generateCourseAiProposal(input: GenerateInput) {
  const status = courseAiStatus(); const requested = input.provider === "auto" ? String(status.defaultProvider || "auto") : input.provider;
  const order: Array<"openai" | "vertex"> = input.mode === "media" ? ["vertex"] : requested === "openai" ? ["openai"] : requested === "vertex" ? ["vertex"] : ["openai", "vertex"];
  const errors: string[] = [];
  for (const provider of order) {
    if (!status.providers.find((entry) => entry.id === provider)?.configured) { errors.push(`${provider === "openai" ? "OpenAI" : "Google Vertex AI"} is not configured.`); continue; }
    try { const result = provider === "openai" ? await callOpenAi(input) : await callVertex(input); return normalizePlan(result, input); }
    catch (error) { errors.push(error instanceof Error ? error.message : `${provider} failed.`); }
  }
  throw new Error(errors.join(" ") || "No approved AI provider is configured for Course Studio.");
}
