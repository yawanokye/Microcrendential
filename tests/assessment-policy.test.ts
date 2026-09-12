import assert from "node:assert/strict";
import test from "node:test";
import { allowedAttempts, gradeAutomaticQuestions, learnerSafeAssessmentConfig, validateAssessmentForPublication } from "../src/lib/assessment-policy";

const questions = [
  { id: "q1", type: "Multiple choice", prompt: "Choose the valid answer", options: ["A", "B"], correctAnswer: "B", points: 2, outcomeIds: ["o1"] },
  { id: "q2", type: "Scenario response", prompt: "Explain your decision", options: [], points: 8, scheme: "Award marks for evidence, reasoning and a justified conclusion.", outcomeIds: ["o2"] },
];

test("learner payload never contains answer keys or marking rubrics", () => {
  const learner = learnerSafeAssessmentConfig({ passMark: 60, attempts: "2 attempts", questions });
  assert.equal(learner.questions.length, 2);
  assert.equal("correctAnswer" in learner.questions[0], false);
  assert.equal("scheme" in learner.questions[1], false);
  assert.equal(learner.questions[1].markingMode, "human");
});

test("manual questions are queued instead of being awarded automatic marks", () => {
  const result = gradeAutomaticQuestions(questions, { q1: "B", q2: "A thoughtful response" });
  assert.equal(result.needsHumanMarking, true);
  assert.equal(result.automaticScore, 100);
  assert.equal(result.provisionalOverallScore, 20);
});

test("attempt parsing is bounded", () => {
  assert.equal(allowedAttempts({ attempts: "3 attempts" }), 3);
  assert.equal(allowedAttempts({ attempts: "999" }), 20);
  assert.equal(allowedAttempts({ attempts: "none" }), 1);
});

test("publication requires a rubric for human-marked evidence", () => {
  assert.equal(validateAssessmentForPublication({ questions }).valid, true);
  const invalid = validateAssessmentForPublication({ questions: [{ ...questions[1], scheme: "" }] });
  assert.equal(invalid.valid, false);
  assert.match(invalid.issues.join(" "), /rubric/i);
});
