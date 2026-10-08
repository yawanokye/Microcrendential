import type { DatabaseSync } from "node:sqlite";

/** Additive, repeatable migrations. Existing approved courses and learning records are preserved. */
export function migrateDelivery(database: DatabaseSync) {
  const column = (table: string, name: string, definition: string) => {
    const columns = database.prepare(`PRAGMA table_info(${table})`).all() as {name:string}[];
    if (!columns.some(c => c.name === name)) database.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  };
  column("enrollments", "course_snapshot_json", "TEXT");
  column("users", "is_test_record", "INTEGER NOT NULL DEFAULT 0");
  column("virtual_lab_submissions", "course_code", "TEXT");
  column("support_requests", "updated_at", "TEXT");
  database.exec(`
CREATE TABLE IF NOT EXISTS course_team (course_code TEXT NOT NULL, user_email TEXT NOT NULL, team_role TEXT NOT NULL CHECK(team_role IN ('cofacilitator','marker','moderator')), assigned_by TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(course_code,user_email));
CREATE TABLE IF NOT EXISTS course_runs (id INTEGER PRIMARY KEY, base_code TEXT NOT NULL, offering_code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, starts_at TEXT, ends_at TEXT, enrolment_closes_at TEXT, capacity INTEGER NOT NULL DEFAULT 0, created_by TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS course_cohorts (id INTEGER PRIMARY KEY, course_code TEXT NOT NULL, name TEXT NOT NULL, UNIQUE(course_code,name));
CREATE TABLE IF NOT EXISTS cohort_members (cohort_id INTEGER NOT NULL REFERENCES course_cohorts(id), user_email TEXT NOT NULL, PRIMARY KEY(cohort_id,user_email));
CREATE TABLE IF NOT EXISTS learner_workspace (user_email TEXT NOT NULL, course_code TEXT NOT NULL, item_key TEXT NOT NULL, value_json TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_email,course_code,item_key));
CREATE TABLE IF NOT EXISTS studio_recovery (user_email TEXT NOT NULL, draft_key TEXT NOT NULL, payload_json TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_email,draft_key));
CREATE TABLE IF NOT EXISTS registration_drafts (user_email TEXT PRIMARY KEY, payload_json TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS engagement_events (id INTEGER PRIMARY KEY, user_email TEXT NOT NULL, course_code TEXT NOT NULL, event_type TEXT NOT NULL, event_day TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_email,course_code,event_type,event_day));
CREATE INDEX IF NOT EXISTS engagement_month_idx ON engagement_events(event_day,user_email);
CREATE TABLE IF NOT EXISTS notification_preferences (user_email TEXT PRIMARY KEY, assessment_reminders INTEGER NOT NULL DEFAULT 1, session_reminders INTEGER NOT NULL DEFAULT 1, teaching_alerts INTEGER NOT NULL DEFAULT 1, weekly_digest INTEGER NOT NULL DEFAULT 0, email_enabled INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS delivery_notifications (id INTEGER PRIMARY KEY, user_email TEXT NOT NULL, dedupe_key TEXT NOT NULL, category TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL, link TEXT NOT NULL DEFAULT '/', read_at TEXT, email_status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_email,dedupe_key));
CREATE INDEX IF NOT EXISTS notification_owner_idx ON delivery_notifications(user_email,id);
CREATE TABLE IF NOT EXISTS course_posts (id INTEGER PRIMARY KEY, course_code TEXT NOT NULL, parent_id INTEGER REFERENCES course_posts(id), author_email TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('discussion','announcement')), title TEXT NOT NULL, message TEXT NOT NULL, hidden INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS posts_course_idx ON course_posts(course_code,id);
CREATE TABLE IF NOT EXISTS delivery_sessions (id INTEGER PRIMARY KEY, course_code TEXT NOT NULL, title TEXT NOT NULL, starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, meeting_url TEXT NOT NULL, recording_url TEXT NOT NULL DEFAULT '', attendance_required INTEGER NOT NULL DEFAULT 1, cancelled INTEGER NOT NULL DEFAULT 0, created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS session_attendance (session_id INTEGER NOT NULL REFERENCES delivery_sessions(id), user_email TEXT NOT NULL, attended INTEGER NOT NULL DEFAULT 1, recorded_by TEXT NOT NULL, recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(session_id,user_email));
CREATE TABLE IF NOT EXISTS grading_jobs (id INTEGER PRIMARY KEY, submission_id INTEGER NOT NULL UNIQUE, state TEXT NOT NULL DEFAULT 'queued', attempts INTEGER NOT NULL DEFAULT 0, config_json TEXT NOT NULL, last_error TEXT, next_attempt_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, locked_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS evidence_grading_jobs (id INTEGER PRIMARY KEY, target_type TEXT NOT NULL, target_id INTEGER NOT NULL, course_code TEXT NOT NULL, user_email TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'queued', attempts INTEGER NOT NULL DEFAULT 0, config_json TEXT NOT NULL, payload_json TEXT NOT NULL, last_error TEXT, next_attempt_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, locked_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(target_type,target_id));
CREATE TABLE IF NOT EXISTS evidence_grade_history (id INTEGER PRIMARY KEY, target_type TEXT NOT NULL, target_id INTEGER NOT NULL, actor_email TEXT NOT NULL, before_json TEXT NOT NULL, after_json TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS grade_history (id INTEGER PRIMARY KEY, submission_id INTEGER NOT NULL, actor_email TEXT NOT NULL, previous_score INTEGER, new_score INTEGER, previous_status TEXT, new_status TEXT, reason TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS assessment_appeals (id INTEGER PRIMARY KEY, submission_id INTEGER NOT NULL, user_email TEXT NOT NULL, reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', response TEXT NOT NULL DEFAULT '', decided_by TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, decided_at TEXT);
CREATE TABLE IF NOT EXISTS credential_reviews (id INTEGER PRIMARY KEY, certificate_code TEXT NOT NULL, reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', decision TEXT, decided_by TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, decided_at TEXT);
CREATE UNIQUE INDEX IF NOT EXISTS credential_open_review_idx ON credential_reviews(certificate_code) WHERE status='open';
CREATE TABLE IF NOT EXISTS support_replies (id INTEGER PRIMARY KEY, request_id INTEGER NOT NULL REFERENCES support_requests(id), author_email TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS refund_requests (id INTEGER PRIMARY KEY, payment_reference TEXT NOT NULL, user_email TEXT NOT NULL, reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'requested', response TEXT NOT NULL DEFAULT '', external_reference TEXT, decided_by TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, decided_at TEXT, UNIQUE(payment_reference,user_email));
CREATE TABLE IF NOT EXISTS course_evaluations (user_email TEXT NOT NULL, course_code TEXT NOT NULL, rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), feedback TEXT NOT NULL DEFAULT '', updated_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_email,course_code));
CREATE TABLE IF NOT EXISTS usage_invoice_snapshots (month TEXT PRIMARY KEY, definition TEXT NOT NULL, report_json TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
`);
  // Pin existing enrolments once. Revisions after this migration do not replace their syllabus.
  database.exec(`UPDATE enrollments SET course_snapshot_json=(SELECT json_object('code',c.code,'title',c.title,'materials_json',c.materials_json,'activities_json',c.activities_json,'assessment_config_json',c.assessment_config_json,'design_json',c.design_json,'question_limit',c.question_limit,'certificate_enabled',c.certificate_enabled,'certificate_preapproved',c.certificate_preapproved,'approval_reference',c.approval_reference,'approval_authority',c.approval_authority,'created_by_email',c.created_by_email,'version_number',c.version_number) FROM course_drafts c WHERE c.code=enrollments.course_code LIMIT 1) WHERE course_snapshot_json IS NULL;`);
}
