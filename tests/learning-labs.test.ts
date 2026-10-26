import assert from "node:assert/strict";
import test from "node:test";
import { describeLabColumn, exportLabCsv, fitLabModel, initialLabWork, investigateLabLogs, labKinds, labSubmissionIssues, learningLabIssues, learningLabTemplate, labStarterCode, normalizeLearningLab, ohmsLawTrial, parseLabCsv, readLabWork } from "../src/lib/learning-labs";
import { ensureStructuredLearningActivities } from "../src/lib/structured-learning-activities";
import { defaultCourseDesign, evaluateCourseQuality } from "../src/lib/course-design";
import { courseDevelopmentReview, technicalTeachingGuidance } from "../src/lib/course-development";
import { promptFor } from "../src/lib/course-ai";

test("All five working lab templates provide valid data, tasks and evidence without requiring a lab or external account", () => {
  for (const kind of Object.keys(labKinds) as (keyof typeof labKinds)[]) { const t = learningLabTemplate(kind); assert.deepEqual(learningLabIssues(t.lab), []); assert.equal(t.lab.reviewed, false); assert.equal(t.lab.allowDataUpload, false); assert.ok(t.rubric.includes("marks")); }
  assert.equal(normalizeLearningLab(undefined), undefined);
  assert.ok(learningLabIssues(normalizeLearningLab({ kind: "pretend-runtime" })!).includes("Choose a supported working lab."));
});
test("CSV parsing preserves quoted commas, embedded lines and escaped quotes without treating data as code", () => {
  const data = parseLabCsv('\uFEFFname,note,value\r\n"A, B","first\nsecond",2\r\nC,"quoted ""word""",-3.5');
  assert.equal(data.rows[0].name, "A, B"); assert.equal(data.rows[0].note, "first\nsecond"); assert.equal(data.rows[1].note, 'quoted "word"'); assert.equal(data.rows[1].value, -3.5);
  assert.equal(parseLabCsv('source,value\n__proto__,"=HYPERLINK(1)"').rows[0].value, "=HYPERLINK(1)");
});
test("Malformed or oversized datasets are rejected rather than silently changing observations", () => {
  for (const csv of ['a,a\n1,2', 'a,b\n1', 'a,b\n"unfinished,2', 'a,b\n"done"oops,2', 'a\n' + '1\n'.repeat(1001)]) assert.throws(() => parseLabCsv(csv));
  assert.throws(() => parseLabCsv('x'.repeat(60001)));
});
test("CSV exports neutralise spreadsheet formulas while preserving negative measurements", () => {
  const exported = exportLabCsv(["value"], [{ value: "=1+1" }, { value: "@SUM(1)" }, { value: -4 }]);
  const parsed = parseLabCsv(exported); assert.equal(parsed.rows[0].value, "'=1+1"); assert.equal(parsed.rows[1].value, "'@SUM(1)"); assert.equal(parsed.rows[2].value, -4);
});
test("Data investigations compute actual statistics and account for missing cells", () => {
  const result = describeLabColumn(parseLabCsv('x\n1\n2\n5\nmissing').rows, "x");
  assert.equal(result.count, 3); assert.equal(result.missingOrNonNumeric, 1); assert.equal(result.mean, 8 / 3); assert.equal(result.median, 2);
  assert.throws(() => describeLabColumn([{ x: "missing" }], "x"));
});
test("Regression fits use held-out rows and changing data changes the trained model", () => {
  const rows = Array.from({ length: 12 }, (_, i) => ({ x: i + 1, y: 2 * (i + 1) + 3 }));
  const model = fitLabModel(rows, "x", "y"); assert.equal(model.trainingRows, 9); assert.equal(model.testRows, 3); assert.equal(model.slope, 2); assert.equal(model.intercept, 3); assert.equal(model.rootMeanSquaredError, 0); assert.equal(model.rSquared, 1);
  const changed = structuredClone(rows); changed[2].y = 100; assert.notEqual(fitLabModel(changed, "x", "y").slope, model.slope);
  assert.throws(() => fitLabModel(rows.slice(0, 3), "x", "y")); assert.throws(() => fitLabModel(rows, "x", "x")); assert.throws(() => fitLabModel(rows.map(r => ({ ...r, x: 1 })), "x", "y"));
});
test("An experiment varies independent inputs and produces interpretable physical measurements", () => {
  const a = ohmsLawTrial(6, 100), b = ohmsLawTrial(12, 100), c = ohmsLawTrial(6, 200);
  assert.equal(a.current, .06); assert.equal(a.power, .36); assert.equal(b.current, .12); assert.equal(c.current, .03);
  assert.throws(() => ohmsLawTrial(25, 100)); assert.throws(() => ohmsLawTrial(6, 0)); assert.throws(() => ohmsLawTrial(NaN, 100));
});
test("Security investigations apply the learner threshold and preserve event order", () => {
  const rows = parseLabCsv(learningLabTemplate("cybersecurity").lab.dataCsv).rows;
  const low = investigateLabLogs(rows, 1), high = investigateLabLogs(rows, 3);
  assert.equal(low.alerts.length, 2); assert.equal(high.alerts.length, 1); assert.equal(high.alerts[0].successAfterThreshold, true); assert.equal(investigateLabLogs([...rows].reverse(), 3).alerts[0].successAfterThreshold, false);
  assert.throws(() => investigateLabLogs(rows, 0)); assert.throws(() => investigateLabLogs([{ wrong: "column" }], 3));
});
test("Saved lab work recovers edits and rejects a working record from a different lab type", () => {
  const lab = learningLabTemplate("coding").lab, work = { ...initialLabWork(lab), code: "return data.length;", reflection: "My saved observations" };
  assert.equal(readLabWork(lab, JSON.stringify(work)).code, work.code); assert.equal(readLabWork(lab, "invalid").code, lab.starterCode); assert.equal(readLabWork(lab, JSON.stringify({ ...work, kind: "ai" })).reflection, "");
});
test("Lab submissions need data, experiment history and reflection without trusting reported marks", () => {
  const lab = learningLabTemplate("coding").lab;
  const work = { ...initialLabWork(lab), reflection: "The result matched my independent calculation, with a limitation about missing values.", runs: [{ at: new Date().toISOString(), operation: "JavaScript programme", settings: {}, result: { total: 250, mark: 100, passed: true } }] };
  assert.deepEqual(labSubmissionIssues(lab, work), []);
  assert.ok(labSubmissionIssues(lab, { ...work, reflection: "short" }).length); assert.ok(labSubmissionIssues(lab, { ...work, runs: [] }).length); assert.ok(labSubmissionIssues(lab, { ...work, kind: "ai" }).length);
  const activity = ensureStructuredLearningActivities([], [{ id: "lab", kind: "inline", lab, interactive: { kind: "flashcards", items: [] }, gradingMode: "rule", responseType: "file", mark: 100 }])[0];
  assert.equal(activity.gradingMode, "facilitator"); assert.equal(activity.responseType, "long_text"); assert.equal(activity.required, false); assert.equal(activity.interactive, undefined);
});
test("Scientific submissions need at least three observations", () => {
  const lab = learningLabTemplate("experiment").lab;
  const work = { ...initialLabWork(lab), reflection: "I controlled resistance and varied voltage to examine the current relationship.", runs: [{ at: new Date().toISOString(), operation: "Ideal resistor trial", settings: {}, result: {} }] };
  assert.ok(labSubmissionIssues(lab, work).some(i => i.includes("three observations")));
  work.dataCsv = exportLabCsv(["voltage", "current"], [{ voltage: 2, current: .02 }, { voltage: 4, current: .04 }, { voltage: 6, current: .06 }]); assert.deepEqual(labSubmissionIssues(lab, work), []);
});
test("Untested or orphaned labs block review while courses with no lab remain valid for this check", () => {
  const design = defaultCourseDesign(), lab = learningLabTemplate("coding").lab, material = { id: "lesson", title: "Test lesson", kind: "Read", source: "Author", sectionId: design.sections[0].id, outcomeIds: [design.outcomes[0].id] };
  const input = { design, materials: [material], questionCount: 0 };
  const activity = { id: "lab", kind: "inline" as const, title: "Working lab", instructions: lab.task, rubric: "Review the code and evidence", required: false, passMark: 60, attemptsAllowed: 3, materialId: "lesson", gradingMode: "facilitator" as const, lab };
  const passes = (activities: typeof activity[]) => evaluateCourseQuality({ ...input, activities }).checks.find(c => c.id === "working-labs")?.passed;
  assert.equal(passes([{ ...activity, rubric: "", lab: { ...lab, reviewed: true } }]), false); assert.equal(passes([]), true); assert.equal(passes([activity]), false); assert.equal(passes([{ ...activity, lab: { ...lab, reviewed: true } }]), true); assert.equal(passes([{ ...activity, materialId: "missing", lab: { ...lab, reviewed: true } }]), false);
});
test("Outcome review distinguishes optional practice from required assessed evidence", () => {
  const design = defaultCourseDesign(), materials = [{ id: "lesson", title: "Lesson", kind: "Read", source: "Author", outcomeIds: design.outcomes.map(o => o.id), sectionId: design.sections[0].id, estimatedMinutes: 45 }];
  const activity = { id: "a", kind: "inline" as const, materialId: "lesson", title: "Practice", instructions: "Practise", required: false, passMark: 60, attemptsAllowed: 3 };
  const optional = courseDevelopmentReview({ design, materials, activities: [activity], questions: [] }); assert.equal(optional.outcomes[0].optionalPractice, 1); assert.equal(optional.outcomes[0].requiredPractice, 0); assert.equal(optional.findings.filter(f => f.id.startsWith("evidence-")).length, 2);
  const required = courseDevelopmentReview({ design, materials, activities: [{ ...activity, required: true }], questions: [] }); assert.equal(required.findings.filter(f => f.id.startsWith("evidence-")).length, 0);
});
test("AI course development separates outline planning from lesson development and states real runtime limits", () => {
  const prompt = promptFor({ mode: "idea", stage: "outline", provider: "auto", sourceText: "Teach defensive cybersecurity investigations with supplied evidence.", sectionCount: 4, brief: { audience: "Security analysts", level: "applied", durationHours: 12, goals: "Investigate evidence", deliveryMode: "asynchronous", awardType: "Microcredential", teachingFocus: "cybersecurity", learnerResources: "Synthetic logs", evidenceGoal: "A reasoned incident report" } });
  assert.ok(prompt.includes("no assessment questions yet")); assert.ok(prompt.includes("not a Linux shell")); assert.ok(prompt.includes("Synthetic logs")); assert.ok(prompt.includes("A reasoned incident report")); assert.ok(!prompt.includes("Each section must contain a concise, original HTML learning lesson"));
  assert.ok(technicalTeachingGuidance("experiment").includes("Distinguish protocol rehearsal")); assert.ok(technicalTeachingGuidance("unknown").includes("General or interdisciplinary"));
});

test("Python configuration and starter code survive normalisation and produce portable lab records", () => {
  const template = learningLabTemplate("data_science");
  const lab = normalizeLearningLab({ ...template.lab, language: "python", starterCode: labStarterCode("data_science", "python") })!;
  assert.equal(lab.language, "python"); assert.ok(lab.starterCode.includes("import pandas")); assert.ok(lab.starterCode.includes("import numpy")); assert.equal(initialLabWork(lab).language, "python"); assert.deepEqual(learningLabIssues(lab), []);
  const jsWork = initialLabWork(template.lab); assert.equal(readLabWork(lab, JSON.stringify(jsWork)).code, lab.starterCode);
});
test("Statistical models reject extreme values that would produce misleading non-finite results", () => {
  assert.throws(() => describeLabColumn([{ x: 1e308 }], "x"), /Rescale/);
  assert.throws(() => fitLabModel(Array.from({length: 8}, (_,i) => ({x: 1e308-i,y:i})), "x", "y"), /Rescale/);
});
