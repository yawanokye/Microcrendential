import assert from "node:assert/strict";
import test from "node:test";
import { allowedAttempts, assessmentPassMark, gradeAutomaticQuestions, learnerSafeAssessmentConfig, validateAssessmentForPublication } from "../src/lib/assessment-policy";

const questions = [
  { id: "q1", type: "Multiple choice", prompt: "Choose the valid answer", options: ["A", "B"], correctAnswer: "B", points: 2, outcomeIds: ["o1"], previewed: true, approved: true },
  { id: "q2", type: "Scenario response", prompt: "Explain your decision", options: [], points: 8, scheme: "Award marks for evidence, reasoning and a justified conclusion.", outcomeIds: ["o2"], previewed: true, approved: true, gradingMode: "ai_auto" as const },
];

test("learner payload never contains answer keys or marking rubrics", () => {
  const learner = learnerSafeAssessmentConfig({ passMark: 60, attempts: "2 attempts", questions });
  assert.equal(learner.questions.length, 2);
  assert.equal("correctAnswer" in learner.questions[0], false);
  assert.equal("scheme" in learner.questions[1], false);
  assert.equal(learner.questions[1].markingMode, "ai");
});

test("rule questions are scored locally and rubric questions are queued for AI grading", () => {
  const result = gradeAutomaticQuestions(questions, { q1: "B", q2: "A thoughtful response" });
  assert.equal(result.earned, 2);
  assert.equal(result.ruleAvailable, 2);
  assert.equal(result.aiAvailable, 8);
  assert.equal(result.ruleScore, 100);
  assert.equal(result.aiQuestions.length, 1);
  assert.equal(result.aiQuestions[0].id, "q2");
  assert.match(result.feedback[0].feedback ?? "", /correct/i);
});


test("facilitator pass marks are applied exactly without rounding a failing mark up", () => {
  const passMark = assessmentPassMark({ passMark: 60 });
  assert.equal(passMark, 60);
  assert.equal(59 >= passMark, false);
  assert.equal(60 >= passMark, true);
});

test("attempt parsing is bounded", () => {
  assert.equal(allowedAttempts({ attempts: "3 attempts" }), 3);
  assert.equal(allowedAttempts({ attempts: "999" }), 20);
  assert.equal(allowedAttempts({ attempts: "none" }), 1);
});

test("publication requires a rubric for AI-marked evidence", () => {
  assert.equal(validateAssessmentForPublication({ questions }).valid, true);
  const invalid = validateAssessmentForPublication({ questions: [{ ...questions[1], scheme: "" }] });
  assert.equal(invalid.valid, false);
  assert.match(invalid.issues.join(" "), /rubric/i);
});
