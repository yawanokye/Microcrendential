import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getRawDb } from "../src/db/raw";
import { queueCourseAi, processCourseAiJob } from "../src/lib/course-ai-jobs";
import { defaultCourseDesign } from "../src/lib/course-design";
import type { CourseAiProposal, GenerateInput } from "../src/lib/course-ai";
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "ucc-section-tests-")); process.env.SQLITE_PATH = join(process.env.DATA_DIR, "test.sqlite");
const design = defaultCourseDesign(); design.sections = [{ id: "approved-first", title: "Evidence", description: "Check the evidence" }, { id: "approved-second", title: "Decision records", description: "Document the audit trail" }]; design.outcomes = [{ id: "approved-evidence", statement: "Evaluate evidence for a decision.", skill: "Appraisal", assessmentMethod: "Case" }, { id: "approved-record", statement: "Document a reasoned decision.", skill: "Documentation", assessmentMethod: "Case" }];
const input: GenerateInput = { mode: "manual", provider: "openai", stage: "lessons", generationStrategy: "sectioned", sectionCount: 2, sourceText: "Evidence informs decisions. Decision records establish an audit trail.", approvedOutline: JSON.stringify({ title: "Approved course", design }) };
test("Saved section generation survives a provider failure and resumes only unfinished work with distinct IDs", async () => {
  const original = globalThis.fetch, key = process.env.OPENAI_API_KEY; process.env.OPENAI_API_KEY = "isolated-section-test"; let calls = 0;
  globalThis.fetch = async (_url, init) => { calls++; if (calls === 2) return new Response(JSON.stringify({ error: { message: "Simulated interruption" } }), { status: 503 });
    const body = JSON.parse(String(init?.body)), second = body.input.includes("approved section: Decision records"), outcomes = second ? [...design.outcomes].reverse() : design.outcomes;
    return Response.json({ output_text: JSON.stringify({ title: "Provider drift must not replace title", outcomes, sections: [{ title: "Generated", description: "Section", lessonHtml: "<p>A developed lesson about evidence and a documented decision.</p>", outcomeIndexes: [0], alignmentReason: "The decision requires this demonstrated skill.", sourceExcerpt: "Evidence informs decisions.", interactive: { kind: "flashcards", items: [{ id: "a", prompt: "Evidence", answer: "Verifiable support", choices: [], explanation: "Use verifiable support." }], order: [] } }], assessmentQuestions: [{ type: "Short answer", prompt: "Explain how evidence informs a decision.", correctAnswer: "Review reliable evidence", outcomeIndexes: [0] }] }), usage: { input_tokens: 10, output_tokens: 20 } }); };
  try {
    const id = queueCourseAi("author@example.test", input); await Promise.all([processCourseAiJob(id), processCourseAiJob(id)]);
    const row = await getRawDb().prepare("SELECT status FROM course_ai_jobs WHERE id=?").bind(id).first<{status:string}>(); assert.equal(row?.status, "queued"); assert.equal(calls, 1);
    await processCourseAiJob(id); assert.equal((await getRawDb().prepare("SELECT status FROM course_ai_jobs WHERE id=?").bind(id).first<{status:string}>())?.status, "failed");
    assert.throws(() => queueCourseAi("other@example.test", input, id), /Only your/);
    const retry = queueCourseAi("author@example.test", input, id); await processCourseAiJob(retry);
    const result = await getRawDb().prepare("SELECT status,proposal_json,request_units,input_tokens FROM course_ai_jobs WHERE id=?").bind(retry).first<{status:string;proposal_json:string;request_units:number;input_tokens:number}>();
    assert.equal(calls, 3); assert.equal(result?.status, "completed"); assert.equal(result?.request_units, 1); assert.equal(result?.input_tokens, 10);
    const proposal = JSON.parse(result!.proposal_json) as CourseAiProposal; assert.equal(proposal.draft.title, "Approved course"); assert.deepEqual(proposal.draft.design.sections, design.sections); assert.equal(new Set(proposal.draft.materials.map(m => m.id)).size, proposal.draft.materials.length);
    assert.deepEqual(proposal.draft.materials.filter(m=>m.kind==="Read").map(m=>m.outcomeIds), [["approved-evidence"], ["approved-record"]]); assert.equal(proposal.draft.activities[1].sectionId, "approved-second");
    assert.equal(proposal.sourceCoverage?.analysedCharacters, input.sourceText.length);
  } finally { globalThis.fetch = original; if (key === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = key; }
});
test("Sectioned requests reserve every planned call before generation starts", async () => {
  await getRawDb().prepare("INSERT OR REPLACE INTO platform_settings(setting_key,setting_value) VALUES('course_ai_daily_limit','1')").run(); assert.throws(() => queueCourseAi("limited@example.test", input), /needs 2 provider calls/);
});
