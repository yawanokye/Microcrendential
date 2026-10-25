import "./seed-commercial-test";
import { getRawDb } from "../src/db/raw";
import { enrolWithSnapshot } from "../src/lib/course-access";
import { buildIllustrativeCourseTemplate } from "../src/lib/illustrative-course";
import { labKinds, labStarterCode, learningLabTemplate, type LabKind } from "../src/lib/learning-labs";
const asset = { name: "Example.txt", size: 0, type: "text/plain", publicUrl: "https://example.test/example.txt" };
const course = buildIllustrativeCourseTemplate("https://example.test", { casePack: asset, capstoneBrief: asset, notebook: asset, questionBank: asset });
const materials = Object.keys(labKinds).map(kind => ({ id: `lab-${kind}`, title: `Working lab ${kind}`, kind: "Read", source: "Synthetic acceptance fixture", readableHtml: `<h2>Investigate and explain</h2><p>Use the working lab, change an input, inspect the result and explain your findings and limitations.</p>`, sectionId: course.design.sections[0].id, sectionTitle: course.design.sections[0].title, outcomeIds: course.design.outcomes.map(o => o.id), accessibilityChecked: true, estimatedMinutes: 45, required: false }));
const activities = Object.keys(labKinds).map(kind => { const t = learningLabTemplate(kind as LabKind); return { id: `working-${kind}`, kind: "inline", materialId: `lab-${kind}`, sectionId: course.design.sections[0].id, sectionTitle: course.design.sections[0].title, title: t.title, instructions: t.instructions, rubric: t.rubric, lab: { ...t.lab, reviewed: true }, required: kind === "coding", gradingMode: "facilitator", responseType: "long_text", maxMark: 100, passMark: 60, attemptsAllowed: 3 }; });
const questions = [{ id: "final", type: "Multiple choice", prompt: "What supports a responsible finding?", options: ["Evidence", "Guesswork"], correctAnswer: "Evidence", points: 1, approved: true, previewed: true, gradingMode: "rule", outcomeIds: course.design.outcomes.map(o => o.id) }];
const db = getRawDb();
for (const [code, status, includeLabs] of [["E2E-LABS", "active", true], ["E2E-LAB-DRAFT", "draft", false]] as const) {
  await db.prepare("INSERT INTO course_drafts(code,title,status,created_by_email,discipline,description,design_json,materials_json,activities_json,assessment_config_json,assessment_modes_json,question_limit,certificate_preapproved) VALUES(?,?,?,'owner@example.test',?,?,?,?,?,?,'[\"Objective quiz\"]',1,1)")
    .bind(code, `Working learning labs ${code}`, status, course.discipline, course.description, JSON.stringify(course.design), JSON.stringify(materials), JSON.stringify(includeLabs ? activities : []), JSON.stringify({ passMark: 60, attempts: "3", questions: status === "draft" ? questions.map(q => ({ ...q, outcomeIds: [course.design.outcomes[0].id] })) : questions })).run();
}
enrolWithSnapshot("learner@example.test", "E2E-LABS");
console.log(JSON.stringify({ workingLabsSeeded: true }));

const pythonTemplate = learningLabTemplate("coding");
const pythonActivity = { ...activities[0], id: "working-python", materialId: "python-lesson", required: true, lab: { ...pythonTemplate.lab, language: "python", starterCode: labStarterCode("coding", "python"), reviewed: true } };
await db.prepare("INSERT INTO course_drafts(code,title,status,created_by_email,discipline,description,design_json,materials_json,activities_json,assessment_config_json,assessment_modes_json,question_limit,certificate_preapproved) VALUES('E2E-PYTHON','Python working lab','active','owner@example.test',?,?,?,?,?,?,'[\"Objective quiz\"]',1,1)")
  .bind(course.discipline, course.description, JSON.stringify(course.design), JSON.stringify([{ ...materials[0], id: "python-lesson", title: "Run Python and scientific libraries" }]), JSON.stringify([pythonActivity]), JSON.stringify({ passMark: 60, attempts: "3", questions })).run();
enrolWithSnapshot("learner@example.test", "E2E-PYTHON");
