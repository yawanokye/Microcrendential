import type { DatabaseSync } from "node:sqlite";

// Programme transcripts use the latest released attempt. The legacy aggregate
// remains a fallback for pre-submission records with no individual attempt rows.
export const programmeResultSql = "SELECT score,passed,completed_at FROM (SELECT final_score score,passed,marked_at completed_at,1 priority,id FROM assessment_submissions WHERE user_email=? AND course_code=? AND status='marked' AND final_score IS NOT NULL UNION ALL SELECT a.score,a.passed,a.completed_at,0 priority,0 id FROM assessment_attempts a WHERE a.user_email=? AND a.course_code=? AND NOT EXISTS(SELECT 1 FROM assessment_submissions s WHERE s.user_email=a.user_email AND s.course_code=a.course_code)) ORDER BY priority DESC,id DESC LIMIT 1";
export type ReleasedProgrammeResult = { score: number; passed: number; completed_at: string };
export function releasedProgrammeResult(db: DatabaseSync, email: string, code: string) { return db.prepare(programmeResultSql).get(email, code, email, code) as ReleasedProgrammeResult | undefined; }
