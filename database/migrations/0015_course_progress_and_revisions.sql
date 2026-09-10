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
  base_version_number INTEGER NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','pending_review','rejected','approved')),
  created_by_email TEXT NOT NULL,
  version_number INTEGER NOT NULL DEFAULT 1,
  submitted_at TEXT,
  review_comment TEXT,
  reviewed_by_email TEXT,
  reviewed_at TEXT,
  approved_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS course_revisions_course_idx ON course_revisions(course_id);
CREATE INDEX IF NOT EXISTS course_revisions_creator_idx ON course_revisions(created_by_email);
CREATE INDEX IF NOT EXISTS course_revisions_status_idx ON course_revisions(status);
