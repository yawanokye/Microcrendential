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
