import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {getRawDb} from '../src/db/raw';
import {queueCourseAi,processCourseAiJob,aiDailyLimit,recoverStaleAiJobs} from '../src/lib/course-ai-jobs';
process.env.DATA_DIR=mkdtempSync(join(tmpdir(),'ucc-ai-jobs-'));process.env.SQLITE_PATH=join(process.env.DATA_DIR,'test.sqlite');
const source={mode:'idea' as const,stage:'outline' as const,provider:'openai' as const,sourceText:'A practical evidence-based course for procurement officers.',sectionCount:2};
test('Saved AI request executes once despite overlapping recovery calls and persists its proposal',async()=>{
  const originalFetch=globalThis.fetch,oldKey=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='isolated-test-key';let calls=0;
  globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({output_text:JSON.stringify({title:'Procurement evidence',description:'Use evidence to decide',outcomes:[{statement:'Evaluate the evidence.',skill:'Appraisal',assessmentMethod:'Case'},{statement:'Apply relevant rules.',skill:'Application',assessmentMethod:'Quiz'}],sections:[{title:'First',description:'First section'},{title:'Second',description:'Second section'}],assessmentQuestions:[]}),usage:{input_tokens:25,output_tokens:50}}),{headers:{'content-type':'application/json'}});};
  try{const id=queueCourseAi('author@example.test',source);await Promise.all([processCourseAiJob(id),processCourseAiJob(id)]);const row=await getRawDb().prepare('SELECT status,proposal_json,input_tokens,output_tokens FROM course_ai_jobs WHERE id=?').bind(id).first<{status:string;proposal_json:string;input_tokens:number;output_tokens:number}>();assert.equal(calls,1);assert.equal(row?.status,'completed');assert.equal(JSON.parse(row!.proposal_json).draft.title,'Procurement evidence');assert.equal(row?.input_tokens,25);assert.equal(row?.output_tokens,50);}finally{globalThis.fetch=originalFetch;if(oldKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=oldKey;}
});
test('Daily usage limits are enforced atomically and stale requests require explicit retry',async()=>{const db=getRawDb();await db.prepare("INSERT OR REPLACE INTO platform_settings(setting_key,setting_value) VALUES('course_ai_daily_limit','1')").run();assert.equal(aiDailyLimit(),1);queueCourseAi('limited@example.test',source);assert.throws(()=>queueCourseAi('limited@example.test',source),/daily.*limit/i);const id=queueCourseAi('stale@example.test',source);await db.prepare("UPDATE course_ai_jobs SET status='running',started_at=datetime('now','-15 minutes') WHERE id=?").bind(id).run();await recoverStaleAiJobs();assert.equal((await db.prepare('SELECT status FROM course_ai_jobs WHERE id=?').bind(id).first<{status:string}>())?.status,'failed');});
