import assert from "node:assert/strict";
import test from "node:test";
import { courseAiStatus } from "../src/lib/course-ai";

test("Course Studio AI status reports readiness without exposing credentials", () => {
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-secret-key-that-must-not-be-returned";
  try {
    const status = courseAiStatus();
    assert.equal(status.providers.find((provider) => provider.id === "openai")?.configured, true);
    assert.doesNotMatch(JSON.stringify(status), /test-secret-key-that-must-not-be-returned/);
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});

test("Course Studio AI timeout is configurable and safely bounded", () => {
  const previousTimeout = process.env.COURSE_AI_TIMEOUT_SECONDS;
  try {
    delete process.env.COURSE_AI_TIMEOUT_SECONDS;
    assert.equal(courseAiStatus().timeoutSeconds, 120);
    process.env.COURSE_AI_TIMEOUT_SECONDS = "10";
    assert.equal(courseAiStatus().timeoutSeconds, 45);
    process.env.COURSE_AI_TIMEOUT_SECONDS = "600";
    assert.equal(courseAiStatus().timeoutSeconds, 180);
  } finally {
    if (previousTimeout === undefined) delete process.env.COURSE_AI_TIMEOUT_SECONDS;
    else process.env.COURSE_AI_TIMEOUT_SECONDS = previousTimeout;
  }
});

test("Course Studio accepts the canonical base64 Vertex credential variable", () => {
  const previousProject = process.env.GOOGLE_CLOUD_PROJECT;
  const previousJson = process.env.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON;
  const previousJsonBase64 = process.env.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON_BASE64;
  const previousLegacyBase64 = process.env.GOOGLE_VERTEX_SERVICE_ACCOUNT_BASE64;
  const previousCredentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  try {
    process.env.GOOGLE_CLOUD_PROJECT = "test-project";
    delete process.env.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON;
    delete process.env.GOOGLE_VERTEX_SERVICE_ACCOUNT_BASE64;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    process.env.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON_BASE64 = "test-base64-value";
    assert.equal(courseAiStatus().providers.find((provider) => provider.id === "vertex")?.configured, true);
  } finally {
    if (previousProject === undefined) delete process.env.GOOGLE_CLOUD_PROJECT; else process.env.GOOGLE_CLOUD_PROJECT = previousProject;
    if (previousJson === undefined) delete process.env.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON; else process.env.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON = previousJson;
    if (previousJsonBase64 === undefined) delete process.env.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON_BASE64; else process.env.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON_BASE64 = previousJsonBase64;
    if (previousLegacyBase64 === undefined) delete process.env.GOOGLE_VERTEX_SERVICE_ACCOUNT_BASE64; else process.env.GOOGLE_VERTEX_SERVICE_ACCOUNT_BASE64 = previousLegacyBase64;
    if (previousCredentialsPath === undefined) delete process.env.GOOGLE_APPLICATION_CREDENTIALS; else process.env.GOOGLE_APPLICATION_CREDENTIALS = previousCredentialsPath;
  }
});
