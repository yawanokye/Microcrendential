import assert from "node:assert/strict";
import test from "node:test";
import { defaultCourseDesign, evaluateCourseQuality, normalizeCourseDesign } from "../src/lib/course-design";

test("programme initiation source and programme home are normalized as governance metadata", () => {
  const design = normalizeCourseDesign({ ...defaultCourseDesign(), programmeInitiationSource: "code", originatingUnit: "College of Distance Education", programmeHome: "College of Distance Education", contributingUnits: ["School of Business", "Department of Computer Science"], identifiedNeed: "Cross-disciplinary career need" });
  assert.equal(design.programmeInitiationSource, "code");
  assert.equal(design.programmeHome, "College of Distance Education");
  assert.equal(design.contributingUnits.length, 2);
});

test("publish readiness requires programme source, originating unit and programme home", () => {
  const design = defaultCourseDesign();
  const result = evaluateCourseQuality({ title: "A sufficiently clear course title", description: "A learner-facing description that is deliberately long enough to pass the course identity check and explain the offer.", design, materials: [], questionCount: 0 });
  const governance = result.checks.find((item) => item.id === "governance");
  assert.equal(governance?.passed, false);
  assert.match(governance?.detail ?? "", /do not create a separate approval pathway/i);
});
