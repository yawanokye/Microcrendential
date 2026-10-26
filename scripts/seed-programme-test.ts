import "./seed-commercial-test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { getRawDb } from "../src/db/raw";
import { defaultCourseDesign } from "../src/lib/course-design";
import { emptyProgramme } from "../src/lib/programme-policy";
const db = getRawDb();
for (const name of ["learner2", "learner3"]) { await db.prepare("INSERT INTO auth_accounts(email,full_name,password_hash,password_salt,email_verified_at) VALUES(?,?,'not-a-password','test-only',CURRENT_TIMESTAMP)").bind(name + "@example.test", "Test " + name).run(); await db.prepare("INSERT INTO users(email,full_name,role,status,identity_status,is_test_record) VALUES(?,?,'learner','active','verified',1)").bind(name + "@example.test", "Test " + name).run(); }
for (const [index, title] of ["Foundations of evidence", "Qualitative methods", "Quantitative methods", "Applied capstone", "Professional practicum", "Advanced inquiry"].entries()) {
  const design = defaultCourseDesign(); design.offeringType = "programme_course"; design.enrolmentMode = "programme"; design.priceGhs = index === 0 ? 100 : 0; design.creditValue = 3; design.delivery.markingMode = "human";
  const material = { id: "lesson", title, kind: "Read", source: "Synthetic acceptance fixture", sectionId: "section-1", required: false, readableHtml: "<h2>" + title + "</h2><p>Examine the supplied evidence and justify a defensible academic conclusion.</p>", accessibilityChecked: true };
  const assessment = { passMark: 50, attempts: "3", questions: [{ id: "q1", type: "Multiple choice", prompt: "What should support an academic conclusion?", options: ["Evidence", "Guesswork"], correctAnswer: "Evidence", points: 1, approved: true, previewed: true, gradingMode: "rule", outcomeIds: ["outcome-1"] }] };
  await db.prepare("INSERT INTO course_drafts(code,title,status,created_by_email,design_json,materials_json,assessment_config_json,certificate_enabled,approval_reference) VALUES(?,?,'active','owner@example.test',?,?,?,0,'SYNTHETIC-COURSE-APPROVAL')").bind("E2E-P" + (index + 1), title, JSON.stringify(design), JSON.stringify([material]), JSON.stringify(assessment)).run();
}
const config = emptyProgramme(); Object.assign(config, { code: "PRG-TEST", title: "Applied Inquiry degree", qualificationTitle: "Bachelor of Science in Applied Inquiry", award: "bachelors", academicUnit: "Acceptance testing unit", description: "A synthetic degree curriculum for production acceptance testing of learning delivery and academic review.", entryRequirements: "Authorised synthetic admission", duration: "Two test semesters", minimumCredits: 12, enforceTermProgression: true, allowCreditRecognition: true, maximumRecognisedCredits: 3, grading: { enabled: true, minimumGpa: 3, bands: [{ minimum: 70, grade: "A", points: 4 }, { minimum: 60, grade: "B", points: 3 }, { minimum: 50, grade: "C", points: 2 }, { minimum: 0, grade: "F", points: 0 }] } });
config.certificate = { enabled: true, release: "registry", includeAcademicLead: true };
config.terms = [{ id: "term-1", title: "Semester 1" }, { id: "term-2", title: "Semester 2" }]; config.electiveGroups = [{ id: "methods", title: "Methods elective", minimumCredits: 3 }];
config.courses = [1, 2, 3, 4, 5].map(i => ({ code: "E2E-P" + i, title: ["Foundations of evidence", "Qualitative methods", "Quantitative methods", "Applied capstone", "Professional practicum"][i - 1], credits: 3, passMark: 50, termId: i < 4 ? "term-1" : "term-2", required: ![2, 3].includes(i), groupId: [2, 3].includes(i) ? "methods" : "", prerequisites: i === 4 ? ["E2E-P1"] : [], category: i === 4 ? "project" : i === 5 ? "practicum" : "taught" }));
writeFileSync(join(process.env.DATA_DIR!, "programme-fixture.json"), JSON.stringify(config));
await db.prepare("INSERT INTO assessment_attempts(user_email,course_code,score,passed,completed_at) VALUES('learner2@example.test','E2E-P1',90,1,'2020-01-01 12:00:00')").run();
console.log(JSON.stringify({ programmeFixture: true }));
