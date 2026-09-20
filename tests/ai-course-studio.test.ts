import assert from "node:assert/strict";
import test from "node:test";
import { getAiIntegrationStatus, normalizeAiCourseSuggestion, validateVertexMediaSource } from "../src/lib/ai-course-studio";

const sampleQuestion = {
  type: "Short answer" as const,
  prompt: "Explain how the concept applies in an authentic workplace setting.",
  options: [],
  correctAnswer: "A response grounded in the course concept and relevant evidence.",
  points: 10,
  scheme: "Award marks for correct application, relevant evidence and a clear explanation.",
  feedbackCorrect: "Your response applies the concept appropriately.",
  feedbackIncorrect: "Review the example and connect the concept to the evidence.",
  learnerAdvice: "Name the concept, cite evidence and explain the connection.",
  outcomeIds: ["outcome-1"],
};

const sampleSuggestion = {
  title: "Evidence-Informed Professional Practice",
  discipline: "Interdisciplinary" as const,
  description: "This short course develops practical capacity to interpret evidence and use it responsibly when making decisions in authentic professional contexts.",
  intendedAudience: "Professionals and adult learners who want to improve evidence-informed workplace decisions.",
  prerequisites: "No specialist knowledge is required before beginning this introductory course.",
  accessibilityStatement: "All learning materials should include accessible text alternatives and clear document structure.",
  objectives: ["Explain the foundations of evidence-informed practice.", "Apply evidence to an authentic professional decision."],
  outcomes: [
    { id: "outcome-1", statement: "Explain how evidence informs a professional decision.", skill: "Evidence interpretation", assessmentMethod: "Short-answer explanation" },
    { id: "outcome-2", statement: "Apply evidence to recommend a defensible course of action.", skill: "Applied decision-making", assessmentMethod: "Scenario response" },
  ],
  skills: ["Evidence interpretation"],
  sections: [{ id: "section-1", title: "Evidence foundations", description: "Learn how evidence can support defensible professional decisions." }],
  learningBlocks: [
    { title: "Understanding evidence", sectionId: "section-1", contentMarkdown: "## Understanding evidence\n\nEvidence must be examined for relevance, quality and context before it is used to support a professional decision.", estimatedMinutes: 600, outcomeIds: ["outcome-1"] },
    { title: "Applying evidence", sectionId: "section-1", contentMarkdown: "## Applying evidence\n\nApply the available evidence to a realistic scenario, explain assumptions and justify a proportionate course of action.", estimatedMinutes: 480, outcomeIds: ["outcome-2"] },
  ],
  resourceSuggestions: [
    { title: "Evidence practice guide", type: "Read" as const, searchQuery: "open evidence informed practice guide", preferredSource: "University repository", reason: "A practical guide can reinforce the lesson concepts.", licenceRequirement: "Facilitator must verify the licence before publishing." },
    { title: "Evidence decision video", type: "Watch" as const, searchQuery: "evidence informed decision making lecture", preferredSource: "University channel", reason: "A short explanation can illustrate practical application.", licenceRequirement: "Facilitator must verify reuse and linking permissions." },
  ],
  activitySuggestions: [{ title: "Decision scenario", type: "case_study" as const, instructions: "Review the scenario, identify the strongest evidence and recommend a justified action.", evidence: "A written recommendation with cited evidence.", required: true, rubric: "Assess relevance of evidence, quality of reasoning and clarity of the recommendation.", outcomeIds: ["outcome-2"] }],
  assessmentQuestions: Array.from({ length: 15 }, () => ({ ...sampleQuestion })),
  rationale: "The design moves from conceptual understanding to authentic application while maintaining explicit alignment.",
};

test("AI course output is normalized to platform editorial limits", () => {
  const normalized = normalizeAiCourseSuggestion(sampleSuggestion);
  assert.equal(normalized.learningBlocks[0].estimatedMinutes, 240);
  assert.equal(normalized.learningBlocks[1].estimatedMinutes, 240);
  assert.equal(normalized.assessmentQuestions.length, 12);
});

test("Vertex media accepts only supported YouTube and Cloud Storage sources", () => {
  assert.equal(validateVertexMediaSource("https://youtu.be/example123"), "https://youtu.be/example123");
  assert.equal(validateVertexMediaSource("https://www.youtube.com/watch?v=example123"), "https://www.youtube.com/watch?v=example123");
  assert.equal(validateVertexMediaSource("gs://ucc-course-media/example.mp3"), "gs://ucc-course-media/example.mp3");
});

test("Vertex media rejects arbitrary and insecure URLs", () => {
  assert.throws(() => validateVertexMediaSource("https://example.com/video.mp4"), /YouTube URL|Cloud Storage/i);
  assert.throws(() => validateVertexMediaSource("http://youtube.com/watch?v=example123"), /YouTube URL|Cloud Storage/i);
});

test("AI status is safe for the browser and always requires human approval", () => {
  const previousOpenAiKey = process.env.OPENAI_API_KEY;
  const previousFastModel = process.env.OPENAI_FAST_MODEL;
  const previousBalancedModel = process.env.OPENAI_BALANCED_MODEL;
  const previousQualityModel = process.env.OPENAI_QUALITY_MODEL;
  const previousProject = process.env.GOOGLE_CLOUD_PROJECT;
  const previousGoogleToken = process.env.GOOGLE_CLOUD_ACCESS_TOKEN;
  try {
    process.env.OPENAI_API_KEY = "test-secret-openai-key";
    process.env.OPENAI_FAST_MODEL = "test-luna";
    process.env.OPENAI_BALANCED_MODEL = "test-terra";
    process.env.OPENAI_QUALITY_MODEL = "test-sol";
    process.env.GOOGLE_CLOUD_PROJECT = "test-project";
    process.env.GOOGLE_CLOUD_ACCESS_TOKEN = "test-secret-google-token";
    const status = getAiIntegrationStatus();
    assert.equal(status.openai.configured, true);
    assert.deepEqual(status.openai.models, { fast: "test-luna", balanced: "test-terra", quality: "test-sol" });
    assert.equal(status.vertex.configured, true);
    assert.equal(status.humanApprovalRequired, true);
    assert.doesNotMatch(JSON.stringify(status), /test-secret/);
  } finally {
    if (previousOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousOpenAiKey;
    if (previousFastModel === undefined) delete process.env.OPENAI_FAST_MODEL;
    else process.env.OPENAI_FAST_MODEL = previousFastModel;
    if (previousBalancedModel === undefined) delete process.env.OPENAI_BALANCED_MODEL;
    else process.env.OPENAI_BALANCED_MODEL = previousBalancedModel;
    if (previousQualityModel === undefined) delete process.env.OPENAI_QUALITY_MODEL;
    else process.env.OPENAI_QUALITY_MODEL = previousQualityModel;
    if (previousProject === undefined) delete process.env.GOOGLE_CLOUD_PROJECT;
    else process.env.GOOGLE_CLOUD_PROJECT = previousProject;
    if (previousGoogleToken === undefined) delete process.env.GOOGLE_CLOUD_ACCESS_TOKEN;
    else process.env.GOOGLE_CLOUD_ACCESS_TOKEN = previousGoogleToken;
  }
});

test("AI Studio accepts the canonical base64 Vertex credential variable", () => {
  const previousProject = process.env.GOOGLE_CLOUD_PROJECT;
  const previousAccessToken = process.env.GOOGLE_CLOUD_ACCESS_TOKEN;
  const previousJson = process.env.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON;
  const previousJsonBase64 = process.env.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON_BASE64;
  const previousLegacyBase64 = process.env.GOOGLE_VERTEX_SERVICE_ACCOUNT_BASE64;
  try {
    process.env.GOOGLE_CLOUD_PROJECT = "test-project";
    delete process.env.GOOGLE_CLOUD_ACCESS_TOKEN;
    delete process.env.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON;
    delete process.env.GOOGLE_VERTEX_SERVICE_ACCOUNT_BASE64;
    process.env.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON_BASE64 = "test-base64-value";
    assert.equal(getAiIntegrationStatus().vertex.configured, true);
  } finally {
    if (previousProject === undefined) delete process.env.GOOGLE_CLOUD_PROJECT; else process.env.GOOGLE_CLOUD_PROJECT = previousProject;
    if (previousAccessToken === undefined) delete process.env.GOOGLE_CLOUD_ACCESS_TOKEN; else process.env.GOOGLE_CLOUD_ACCESS_TOKEN = previousAccessToken;
    if (previousJson === undefined) delete process.env.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON; else process.env.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON = previousJson;
    if (previousJsonBase64 === undefined) delete process.env.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON_BASE64; else process.env.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON_BASE64 = previousJsonBase64;
    if (previousLegacyBase64 === undefined) delete process.env.GOOGLE_VERTEX_SERVICE_ACCOUNT_BASE64; else process.env.GOOGLE_VERTEX_SERVICE_ACCOUNT_BASE64 = previousLegacyBase64;
  }
});
