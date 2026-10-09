import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { extractCourseSource, sourceReferences, transcriptSpans, selectSectionSource } from "../src/lib/course-source";
import { checkAiVerification, runLiveAiVerification, verificationInput, verificationSource } from "../src/lib/course-ai-verification";
import { normalizePlan } from "../src/lib/course-ai";
test("PDF source support identifies actual pages and timestamp references require supplied transcript times", async () => {
  const doc = await PDFDocument.create(), font = await doc.embedFont(StandardFonts.Helvetica);
  for (const text of ["Evidence supports a procurement decision.", "The audit trail records the documented reason."]) doc.addPage().drawText(text, { x: 40, y: 600, font });
  const extracted = await extractCourseSource(Buffer.from(await doc.save()), "manual.pdf", "application/pdf");
  assert.equal(extracted.totalPages, 2); assert.equal(sourceReferences("audit trail", extracted.text, extracted.spans)[0].page, 2);
  const text = "00:00 Introduction\n02:30 Evidence supports decisions.\n05:00 Document the reason.";
  assert.equal(sourceReferences("Evidence supports", text, transcriptSpans(text))[0].timestampSeconds, 150);
  assert.deepEqual(sourceReferences("invented quotation", text, transcriptSpans(text)), []);
  assert.deepEqual(transcriptSpans("No timestamp was supplied."), []);
});
test("Section selection includes relevant late manual content and reports its original location", () => {
  const first = "General introduction. ".repeat(6000), late = "Audit evidence and decision records. ".repeat(1000), text = first + late;
  const selected = selectSectionSource(text, [{ label: "PDF page 1", page: 1, start: 0, end: first.length }, { label: "PDF page 99", page: 99, start: first.length, end: text.length }], "Audit evidence decision records");
  assert.ok(selected.text.includes("Audit evidence")); assert.ok(selected.text.length <= 90000); assert.equal(selected.spans[0].page, 99); assert.equal(selected.originalRanges[0].start, first.length); assert.equal(selected.weakMatch, false);
});
function proposal() {
  return normalizePlan({ provider: "openai", model: "simulated-provider", plan: { title: "Evidence decisions", outcomes: [{ statement: "Evaluate evidence for procurement decisions.", skill: "Appraisal", assessmentMethod: "Case" }, { statement: "Document reasons for a decision.", skill: "Documentation", assessmentMethod: "Case" }], sections: [0, 1].map(i => ({ title: `Lesson ${i}`, description: "Evidence", lessonHtml: `<p>${verificationSource}</p>`, outcomeIndexes: [i], alignmentReason: "The practice requires evidence evaluation and a documented decision.", sourceExcerpt: "Procurement decisions should be supported by verifiable evidence.", activityTitle: "Practice", activityInstructions: "Check and document the decision.", interactive: { kind: "knowledge_check", items: [{ id: "a", prompt: "What supports a decision?", choices: ["Evidence", "Guess"], answer: "Evidence", explanation: "Review reliable evidence before deciding." }, { id: "b", prompt: "What records a decision?", choices: ["Audit trail", "Rumour"], answer: "Audit trail", explanation: "The audit trail records evidence and reasons." }], order: [] } })), assessmentQuestions: [{ type: "Multiple choice", prompt: "What supports a documented decision?", options: ["Evidence", "Guess", "Rumour", "No record"], correctAnswer: "Evidence" }] } } as Parameters<typeof normalizePlan>[0], verificationInput("openai"));
}
test("Live verification separates a valid provider response from invalid keys and ungrounded content", () => {
  const good = proposal(); assert.equal(checkAiVerification(good, 123).status, "passed");
  good.draft.assessmentConfig.questions[0].correctAnswer = "Missing option"; good.draft.materials.forEach(m => { m.sourceExcerpt = undefined; });
  const bad = checkAiVerification(good, 456); assert.equal(bad.status, "needs_review"); assert.equal(bad.checks.filter(c => !c.passed).length, 2);
});
test("An unconfigured live diagnostic makes no provider request and never reports success", async () => {
  const variables = ["OPENAI_API_KEY", "GOOGLE_CLOUD_PROJECT"], saved = variables.map(v => process.env[v]), original = globalThis.fetch;
  variables.forEach(v => { delete process.env[v]; }); globalThis.fetch = async () => { throw new Error("Unexpected provider call"); };
  try { assert.equal((await runLiveAiVerification()).status, "not_configured"); }
  finally { variables.forEach((v, i) => { if (saved[i] === undefined) delete process.env[v]; else process.env[v] = saved[i]; }); globalThis.fetch = original; }
});
