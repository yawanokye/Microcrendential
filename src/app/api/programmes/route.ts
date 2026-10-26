import { audienceAllowed, audienceSql, courseDiscoverySql } from "@/lib/catalogue-access";
import { getRawDb } from "@/db/raw";
import { requireActiveProfile } from "@/lib/accounts";
import { rejectCrossSiteMutation } from "@/lib/request-security";
import { normalizeCourseDesign } from "@/lib/course-design";
import { parseRecord } from "@/lib/course-access";
import { canManageProgramme, getProgramme, getProgrammeEnrolment, presentProgramme, programmeStudyRecord, saveProgramme, ProgrammeError, type ProgrammeRow, type ProgrammeEnrolment } from "@/lib/programmes";
import { programmePayload, programmeResponse, programmeHttpFailure } from "@/lib/programme-http";

export async function GET(request: Request) {
  const account = await requireActiveProfile(); if (account.error || !account.profile) return account.error;
  const actor = account.profile, db = getRawDb(), params = new URL(request.url).searchParams, id = Number(params.get("id")), enrolmentId = Number(params.get("enrolmentId"));
  try {
    if (enrolmentId) { const { enrolment, programme } = await getProgrammeEnrolment(enrolmentId, actor); return programmeResponse({ programme: presentProgramme(programme, actor.role !== "learner"), enrolment, record: await programmeStudyRecord(enrolment, programme) }); }
    if (id) {
      const p = await getProgramme(id);
      const own = await db.prepare("SELECT e.*,u.full_name FROM programme_enrolments e JOIN users u ON u.email=e.user_email WHERE programme_id=? AND user_email=?").bind(id, actor.email).first<ProgrammeEnrolment>();
      if (actor.role === "learner" ? (p.status !== "active" || !audienceAllowed("programme",p.code,actor)) && !own : !canManageProgramme(actor, p)) throw new ProgrammeError("Programme not found.", 404);
      const before = Math.max(0, Number(params.get("before")) || Number.MAX_SAFE_INTEGER);
      const enrolments = actor.role === "learner" ? own ? [own] : [] : (await db.prepare("SELECT e.*,u.full_name FROM programme_enrolments e JOIN users u ON u.email=e.user_email WHERE e.programme_id=? AND e.id<? ORDER BY e.id DESC LIMIT 51").bind(id, before).all<ProgrammeEnrolment>()).results;
      const existingEnrolment = actor.role === "learner" && !own ? await db.prepare("SELECT * FROM programme_enrolments WHERE programme_code=? AND user_email=?").bind(p.code, actor.email).first<ProgrammeEnrolment>() : null;
      return programmeResponse({ existingEnrolment, programme: presentProgramme(p, actor.role !== "learner"), enrolments: enrolments.slice(0, 50), nextCursor: enrolments.length > 50 ? enrolments[49].id : null, ...(own && actor.role === "learner" ? { enrolment: own, record: await programmeStudyRecord(own, p) } : {}) });
    }
    const before = Math.max(0, Number(params.get("before")) || Number.MAX_SAFE_INTEGER);
    const audience=audienceSql("programme","academic_programmes.code",actor), courseAudience=courseDiscoverySql("c.code",actor);
    const rows = actor.role === "learner" ? (await db.prepare(`SELECT * FROM academic_programmes WHERE ((status='active' AND ${audience.sql}) OR id IN (SELECT programme_id FROM programme_enrolments WHERE user_email=?)) AND id<? ORDER BY id DESC LIMIT 101`).bind(...audience.values,actor.email, before).all<ProgrammeRow>()).results : (await db.prepare("SELECT * FROM academic_programmes WHERE (?='admin' OR created_by_email=?) AND id<? ORDER BY id DESC LIMIT 101").bind(actor.role, actor.email, before).all<ProgrammeRow>()).results;
    const courses = actor.role === "learner" ? [] : (await db.prepare(`SELECT code,title,design_json,assessment_config_json FROM course_drafts c WHERE status='active' AND ${courseAudience.sql} ORDER BY title LIMIT 1000`).bind(...courseAudience.values).all<{ code: string; title: string; design_json: string; assessment_config_json: string }>()).results.map(c => { const d = normalizeCourseDesign(parseRecord(c.design_json, {})); return { code: c.code, title: c.title, credits: d.creditValue, passMark: Number(parseRecord<{ passMark?: number }>(c.assessment_config_json, {}).passMark) || 60 }; });
    const ownEnrolments = actor.role === "learner" ? (await db.prepare("SELECT * FROM programme_enrolments WHERE user_email=? ORDER BY id DESC").bind(actor.email).all<ProgrammeEnrolment>()).results : [];
    return programmeResponse({ programmes: rows.slice(0, 100).map(p => presentProgramme(p, actor.role !== "learner")), nextCursor: rows.length > 100 ? rows[99].id : null, courses, ownEnrolments });
  } catch (error) { return programmeHttpFailure(error); }
}
export async function POST(request: Request) {
  const originError = rejectCrossSiteMutation(request); if (originError) return originError;
  const account = await requireActiveProfile(["admin", "facilitator"]); if (account.error || !account.profile) return account.error;
  try { const payload = await programmePayload(request), id = await saveProgramme(account.profile, payload); return programmeResponse({ programme: presentProgramme(await getProgramme(id), true) }, payload.action === "create" || payload.action === "revise" ? 201 : 200); } catch (error) { return programmeHttpFailure(error); }
}
export const PUT = POST;
