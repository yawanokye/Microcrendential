import { getRawDb } from "@/db/raw";
import { generateCourseAiProposal, type CourseAiProposal, type GenerateInput } from "./course-ai";
import { checkAiVerification } from "./course-ai-verification";
import { approvedCourseOutline, inputForSection, combineSectionProposals } from "./course-ai-sections";
export function ensureAiTables() {
  getRawDb().exec(`CREATE TABLE IF NOT EXISTS course_ai_jobs (
    id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, input_json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued',
    proposal_json TEXT, error TEXT, lease TEXT, started_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0
  ); CREATE INDEX IF NOT EXISTS course_ai_owner_idx ON course_ai_jobs(owner_email,created_at);
  CREATE TABLE IF NOT EXISTS course_activity_library (id TEXT PRIMARY KEY,owner_email TEXT NOT NULL,title TEXT NOT NULL,activity_json TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);`);
  const columns = getRawDb().transaction(db => db.prepare("PRAGMA table_info(course_ai_jobs)").all()) as {name:string}[];
  if (!columns.some(c => c.name === "request_units")) getRawDb().exec("ALTER TABLE course_ai_jobs ADD COLUMN request_units INTEGER NOT NULL DEFAULT 1");
  getRawDb().exec(`CREATE TABLE IF NOT EXISTS course_ai_job_sections(job_id TEXT NOT NULL,section_index INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'queued',proposal_json TEXT,error TEXT,PRIMARY KEY(job_id,section_index));`);
}
export function aiDailyLimit() {
  const configured=getRawDb().transaction(native=>native.prepare("SELECT setting_value FROM platform_settings WHERE setting_key='course_ai_daily_limit'").get()) as {setting_value:string}|undefined;
  return Math.min(500,Math.max(1,Number(configured?.setting_value)||Number(process.env.COURSE_AI_DAILY_LIMIT)||30));
}
export function aiEstimatedCost(inputTokens:number,outputTokens:number) {
  if(!process.env.COURSE_AI_INPUT_USD_PER_MILLION?.trim()||!process.env.COURSE_AI_OUTPUT_USD_PER_MILLION?.trim())return null;
  const input=Number(process.env.COURSE_AI_INPUT_USD_PER_MILLION),output=Number(process.env.COURSE_AI_OUTPUT_USD_PER_MILLION);
  return Number.isFinite(input)&&Number.isFinite(output)&&input>=0&&output>=0 ? Math.round((inputTokens*input+outputTokens*output)/1000000*10000)/10000 : null;
}
export function queueCourseAi(owner: string, input: GenerateInput, resumeFrom?: string) {
  ensureAiTables(); const db = getRawDb(), limit = aiDailyLimit();
  const sections = input.generationStrategy === "sectioned" ? approvedCourseOutline(input).design.sections.length : 0;
  return db.transaction(native => {
    const previous = resumeFrom ? native.prepare("SELECT status,input_json FROM course_ai_jobs WHERE id=? AND owner_email=?").get(resumeFrom, owner) as {status:string;input_json:string}|undefined : undefined;
    if (resumeFrom && (!previous || previous.status !== "failed" || previous.input_json !== JSON.stringify(input))) throw new Error("Only your unchanged failed request can resume saved sections.");
    const completed = sections && resumeFrom ? native.prepare("SELECT section_index,proposal_json FROM course_ai_job_sections WHERE job_id=? AND status='completed'").all(resumeFrom) as {section_index:number;proposal_json:string}[] : [];
    const units = Math.max(1, sections - completed.length);
    const count = native.prepare("SELECT COALESCE(SUM(request_units),0) n FROM course_ai_jobs WHERE owner_email=? AND date(created_at)=date('now')").get(owner) as { n: number };
    if (count.n + units > limit) throw new Error(`This request needs ${units} provider calls and would exceed your daily AI limit. Continue manually or contact the administrator.`);
    const active = native.prepare("SELECT COUNT(*) n FROM course_ai_jobs WHERE owner_email=? AND status IN ('queued','running')").get(owner) as { n: number };
    if (active.n >= 2) throw new Error("Two AI requests are already in progress. Wait for a result before starting another.");
    const id = crypto.randomUUID();
    native.prepare("INSERT INTO course_ai_jobs(id,owner_email,input_json,request_units) VALUES(?,?,?,?)").run(id,owner,JSON.stringify(input),units);
    for (let index = 0; index < sections; index++) { const saved = completed.find(s => s.section_index === index); native.prepare("INSERT INTO course_ai_job_sections(job_id,section_index,status,proposal_json) VALUES(?,?,?,?)").run(id,index,saved ? "completed" : "queued",saved?.proposal_json || null); }
    return id;
  });
}
export async function processCourseAiJob(id: string) {
  ensureAiTables(); const db = getRawDb(), lease = crypto.randomUUID();
  const claimed = await db.prepare("UPDATE course_ai_jobs SET status='running',lease=?,started_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='queued'").bind(lease,id).run();
  if (!claimed.meta.changes) return;
  const row = await db.prepare("SELECT input_json FROM course_ai_jobs WHERE id=? AND lease=?").bind(id,lease).first<{ input_json: string }>(); if (!row) return;
  const input = JSON.parse(row.input_json) as GenerateInput;
  let sectionIndex: number | undefined;
  try {
    if (input.generationStrategy === "sectioned") {
      const section = await db.prepare("SELECT section_index FROM course_ai_job_sections WHERE job_id=? AND status!='completed' ORDER BY section_index LIMIT 1").bind(id).first<{section_index:number}>();
      if (section) {
        sectionIndex = section.section_index;
        await db.prepare("UPDATE course_ai_job_sections SET status='running',error=NULL WHERE job_id=? AND section_index=?").bind(id,sectionIndex).run();
        const selected = inputForSection(input,sectionIndex), proposal = await generateCourseAiProposal(selected.input);
        if (selected.weakMatch) proposal.warnings.push("Source relevance was weak for this section. Verify the content against the manual before applying it.");
        // The section result and token usage commit together. A stale worker cannot replace a resumed result.
        db.transaction(native => { const current = native.prepare("SELECT id FROM course_ai_jobs WHERE id=? AND lease=? AND status='running'").get(id,lease); if (!current) return;
          native.prepare("UPDATE course_ai_job_sections SET status='completed',proposal_json=?,error=NULL WHERE job_id=? AND section_index=?").run(JSON.stringify(proposal),id,sectionIndex!);
          native.prepare("UPDATE course_ai_jobs SET input_tokens=input_tokens+?,output_tokens=output_tokens+?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND lease=?").run(proposal.usage?.inputTokens || 0,proposal.usage?.outputTokens || 0,id,lease);
        });
      }
      const saved = await db.prepare("SELECT proposal_json,status FROM course_ai_job_sections WHERE job_id=? ORDER BY section_index").bind(id).all<{proposal_json:string;status:string}>();
      if (saved.results.some(s => s.status !== "completed")) { await db.prepare("UPDATE course_ai_jobs SET status='queued',lease=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND lease=? AND status='running'").bind(id,lease).run(); return; }
      const proposal = combineSectionProposals(input,saved.results.map(s => JSON.parse(s.proposal_json) as CourseAiProposal));
      await db.prepare("UPDATE course_ai_jobs SET status='completed',proposal_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND lease=? AND status='running'").bind(JSON.stringify(proposal),id,lease).run();
    } else {
      const started = Date.now(), proposal = await generateCourseAiProposal(input);
      if (input.verification) proposal.verification = checkAiVerification(proposal,Date.now()-started);
      await db.prepare("UPDATE course_ai_jobs SET status='completed',proposal_json=?,input_tokens=?,output_tokens=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND lease=? AND status='running'").bind(JSON.stringify(proposal),proposal.usage?.inputTokens || 0,proposal.usage?.outputTokens || 0,id,lease).run();
    }
  } catch (e) {
    const error = e instanceof Error ? e.message.slice(0,1500) : "Generation failed.";
    if (sectionIndex !== undefined) await db.prepare("UPDATE course_ai_job_sections SET status='failed',error=? WHERE job_id=? AND section_index=? AND status='running'").bind(error,id,sectionIndex).run();
    await db.prepare("UPDATE course_ai_jobs SET status='failed',error=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND lease=? AND status='running'").bind(error,id,lease).run();
  }
}
export async function recoverStaleAiJobs() {
  ensureAiTables();
  // A lost process never silently spends money again. The owner chooses Retry.
  await getRawDb().prepare("UPDATE course_ai_jobs SET status='failed',error='The worker stopped before completing this request. Retry or continue manually.',updated_at=CURRENT_TIMESTAMP WHERE status='running' AND started_at<datetime('now','-10 minutes')").run();
}
