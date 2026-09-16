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
