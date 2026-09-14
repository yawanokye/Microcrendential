import assert from "node:assert/strict";
import test from "node:test";
import { getAiIntegrationStatus, validateVertexMediaSource } from "../src/lib/ai-course-studio";

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
