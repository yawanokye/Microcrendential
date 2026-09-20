CREATE TABLE IF NOT EXISTS course_content_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_email TEXT NOT NULL,
  course_code TEXT NOT NULL,
  material_id TEXT NOT NULL,
  completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_email, course_code, material_id)
);

CREATE INDEX IF NOT EXISTS course_content_progress_user_idx ON course_content_progress(user_email);
CREATE INDEX IF NOT EXISTS course_content_progress_course_idx ON course_content_progress(course_code);

CREATE TABLE IF NOT EXISTS course_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES course_drafts(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','pending_review','rejected','applied','withdrawn')),
  created_by_email TEXT NOT NULL,
  review_comment TEXT,
  reviewed_by_email TEXT,
  submitted_at TEXT,
  reviewed_at TEXT,
  applied_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approval_authority TEXT,
  approval_meeting_date TEXT,
  approval_reference TEXT,
  approval_recorded_by_email TEXT,
  approval_recorded_at TEXT,
  UNIQUE(course_id, revision_number)
);

CREATE INDEX IF NOT EXISTS course_revisions_course_idx ON course_revisions(course_id);
CREATE INDEX IF NOT EXISTS course_revisions_creator_idx ON course_revisions(created_by_email);
CREATE INDEX IF NOT EXISTS course_revisions_status_idx ON course_revisions(status);
