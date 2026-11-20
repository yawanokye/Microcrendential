import test from "node:test";
import assert from "node:assert/strict";
import { buildCourseOutline, materialKey } from "../src/lib/course-outline";
import { buildLearnerGradeRows } from "../src/lib/learner-grade-display";
import { discoveryLink, learningRoutes } from "../src/lib/learning-discovery";
import type { CourseMaterialRecord } from "../src/lib/course-design";

const sections = [{ id:"one", title:"Module one", description:"" }, { id:"two", title:"Module two", description:"" }];
const item = (title:string, sectionId?:string):CourseMaterialRecord => ({ title, sectionId, kind:"Read", source:"" });

test("course navigation retains unassigned and older lesson records", () => {
  const materials = [item("Unassigned"), item("Unknown section", "old"), {...item("Reading", "two"), id:"reading"}, item("Notes", "one")];
  const outline = buildCourseOutline(sections, materials);
  assert.deepEqual(outline[0].items.map(x => x.material.title), ["Unassigned", "Unknown section", "Notes"]);
  assert.deepEqual(outline[1].items.map(x => x.material.title), ["Reading"]);
  assert.equal(outline[1].items[0].id, "reading");
  assert.equal(materialKey(materials[0], 0), "material-1");
});

test("only marked evidence displays scores, including a real zero", () => {
  const activities = [{id:"practice",title:"Practice",kind:"inline"},{id:"project",title:"Project",kind:"inline"}];
  const statuses = {practice:{status:"submitted",mark:0,maximum:10,feedback:""},project:{status:"assessed",mark:0,maximum:20,feedback:"Please revise"}};
  const submissions = [{id:1,attemptNumber:1,status:"awaiting_marking",finalScore:0},{id:2,attemptNumber:2,status:"marked",finalScore:75,markerFeedback:"Well done",automaticFeedback:[{earned:3,available:4,feedback:"Review your evidence",learnerAdvice:"Explain your reasoning"}]}];
  const rows = buildLearnerGradeRows(activities, statuses, submissions, true);
  assert.equal(rows[0].earned, null);
  assert.equal(rows[0].percentage, null);
  assert.equal(rows[1].earned, 0);
  assert.equal(rows[1].percentage, 0);
  assert.equal(rows[2].earned, null);
  assert.equal(rows[3].earned, 75);
  assert.match(rows[3].feedback, /Well done/);
  assert.match(rows[3].feedback, /Question 1 \(3\/4\): Review your evidence Explain your reasoning/);
});

test("an earlier passed assessment stays visible and unstarted work is not graded", () => {
  const previous = buildLearnerGradeRows([], {}, [], true, {passed:true,score:82});
  assert.equal(previous[0].percentage, 82);
  const unstarted = buildLearnerGradeRows([], {}, [], true);
  assert.equal(unstarted[0].status, "Not started");
  assert.equal(unstarted[0].earned, null);
});

test("each public offering route links to its matching catalogue category", () => {
  for (const route of learningRoutes) {
    const url = new URL(discoveryLink({type:route.id}), "https://example.test");
    assert.equal(url.pathname, "/explore");
    assert.equal(url.searchParams.get("type"), route.id);
  }
});
