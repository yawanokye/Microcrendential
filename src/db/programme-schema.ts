import type { DatabaseSync } from "node:sqlite";

export function migrateProgrammes(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS academic_programmes (
      id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL, title TEXT NOT NULL, version INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('draft','review','active','superseded','closed')),
      config_json TEXT NOT NULL, created_by_email TEXT NOT NULL, lock_version INTEGER NOT NULL DEFAULT 1,
      approval_json TEXT NOT NULL DEFAULT '{}', review_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(code,version)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS academic_programme_active ON academic_programmes(code) WHERE status='active';
    CREATE UNIQUE INDEX IF NOT EXISTS academic_programme_draft ON academic_programmes(code) WHERE status IN ('draft','review');
    CREATE INDEX IF NOT EXISTS academic_programme_owner ON academic_programmes(created_by_email,status);
    CREATE TABLE IF NOT EXISTS programme_enrolments (
      id INTEGER PRIMARY KEY AUTOINCREMENT, programme_id INTEGER NOT NULL REFERENCES academic_programmes(id),
      programme_code TEXT NOT NULL, user_email TEXT NOT NULL, student_number TEXT, cohort TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL CHECK(status IN ('applied','active','deferred','withdrawn','rejected','graduated')),
      current_term INTEGER NOT NULL DEFAULT 1, lock_version INTEGER NOT NULL DEFAULT 1, certificate_checked_at TEXT,
      application_statement TEXT NOT NULL DEFAULT '', admission_reference TEXT NOT NULL DEFAULT '',
      fee_coverage TEXT NOT NULL DEFAULT 'course_fees' CHECK(fee_coverage IN ('course_fees','programme_clearance')),
      financial_reference TEXT NOT NULL DEFAULT '', decision_note TEXT NOT NULL DEFAULT '',
      admitted_by_email TEXT, admitted_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(programme_code,user_email), UNIQUE(programme_code,student_number)
    );
    CREATE INDEX IF NOT EXISTS programme_learner ON programme_enrolments(user_email,status);
    CREATE INDEX IF NOT EXISTS programme_queue ON programme_enrolments(programme_id,id);
    CREATE TABLE IF NOT EXISTS programme_registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT, enrolment_id INTEGER NOT NULL REFERENCES programme_enrolments(id),
      course_code TEXT NOT NULL, course_version INTEGER NOT NULL, registered_by_email TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(enrolment_id,course_code)
    );
    CREATE TABLE IF NOT EXISTS programme_credit_decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, enrolment_id INTEGER NOT NULL REFERENCES programme_enrolments(id),
      course_code TEXT NOT NULL, mark REAL, status TEXT NOT NULL CHECK(status IN ('granted','revoked')),
      reference TEXT NOT NULL, reason TEXT NOT NULL, decided_by_email TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(enrolment_id,course_code)
    );
    CREATE TABLE IF NOT EXISTS programme_certificates (
      id INTEGER PRIMARY KEY AUTOINCREMENT, enrolment_id INTEGER NOT NULL UNIQUE REFERENCES programme_enrolments(id),
      credential_code TEXT NOT NULL UNIQUE, status TEXT NOT NULL CHECK(status IN ('active','under_review','revoked')),
      snapshot_json TEXT NOT NULL, issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS programme_awards (
      id INTEGER PRIMARY KEY AUTOINCREMENT, enrolment_id INTEGER NOT NULL UNIQUE REFERENCES programme_enrolments(id),
      reference TEXT NOT NULL UNIQUE, award_date TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('active','under_review','revoked')),
      evidence_json TEXT NOT NULL, recorded_by_email TEXT NOT NULL, review_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  const columns = db.prepare("PRAGMA table_info(programme_enrolments)").all() as {name:string}[];
  if (!columns.some(c => c.name === "certificate_checked_at")) db.exec("ALTER TABLE programme_enrolments ADD COLUMN certificate_checked_at TEXT");
}
