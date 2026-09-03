import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync, type StatementSync } from "node:sqlite";

type SqlValue = string | number | bigint | null | Uint8Array;
type RunMeta = { changes: number; last_row_id: number | bigint };

class BoundStatement {
  constructor(private readonly statement: StatementSync, private readonly values: SqlValue[] = []) {}
  bind(...values: unknown[]) { return new BoundStatement(this.statement, values.map((value) => value === undefined ? null : value as SqlValue)); }
  async first<T>() { return (this.statement.get(...this.values) as T | undefined) ?? null; }
  async all<T>() { return { results: this.statement.all(...this.values) as T[], success: true }; }
  async run() { const result = this.statement.run(...this.values); return { success: true, meta: { changes: Number(result.changes), last_row_id: result.lastInsertRowid } satisfies RunMeta }; }
}

class RenderDatabase {
  constructor(private readonly database: DatabaseSync) {}
  prepare(sql: string) { return new BoundStatement(this.database.prepare(sql)); }
  exec(sql: string) { this.database.exec(sql); }
}

const schema = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS auth_accounts (
  email TEXT PRIMARY KEY NOT NULL,
  full_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS course_drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  discipline TEXT NOT NULL DEFAULT 'Interdisciplinary',
  description TEXT NOT NULL DEFAULT '',
  materials_json TEXT NOT NULL DEFAULT '[]',
  activities_json TEXT NOT NULL DEFAULT '[]',
  assessment_modes_json TEXT NOT NULL DEFAULT '[]',
  assessment_config_json TEXT NOT NULL DEFAULT '{}',
  design_json TEXT NOT NULL DEFAULT '{}',
  gate_required INTEGER NOT NULL DEFAULT 1,
  question_limit INTEGER NOT NULL DEFAULT 10,
  certificate_enabled INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending_review',
  created_by_email TEXT NOT NULL DEFAULT '',
  activated_by_email TEXT,
  activated_at TEXT,
  version_number INTEGER NOT NULL DEFAULT 1,
  submitted_at TEXT,
  review_comment TEXT,
  reviewed_by_email TEXT,
  reviewed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'learner' CHECK(role IN ('learner','facilitator','admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','pending_setup','pending_verification','rejected','suspended')),
  date_of_birth TEXT,
  gender TEXT,
  nationality TEXT,
  phone TEXT,
  address TEXT,
  id_type TEXT,
  id_last4 TEXT,
  id_document_key TEXT,
  selfie_key TEXT,
  identity_status TEXT NOT NULL DEFAULT 'not_submitted' CHECK(identity_status IN ('not_submitted','pending_review','verified','rejected')),
  verification_note TEXT,
  reviewed_by_email TEXT,
  reviewed_at TEXT,
  verifier_email TEXT,
  invite_token_hash TEXT,
  invite_expires_at TEXT,
  setup_completed_at TEXT,
  created_by_email TEXT,
  student_number TEXT,
  education_level TEXT,
  occupation TEXT,
  organisation TEXT,
  interests_json TEXT NOT NULL DEFAULT '[]',
  preferred_language TEXT NOT NULL DEFAULT 'English',
  accessibility_needs TEXT,
  terms_accepted_at TEXT,
  privacy_accepted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_email TEXT NOT NULL,
  course_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','withdrawn')),
  enrolled_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_email, course_code)
);
CREATE TABLE IF NOT EXISTS assessment_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_email TEXT NOT NULL,
  course_code TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  passed INTEGER NOT NULL DEFAULT 0,
  answers_json TEXT NOT NULL DEFAULT '{}',
  completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_email, course_code)
);
CREATE TABLE IF NOT EXISTS certificates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  certificate_code TEXT NOT NULL UNIQUE,
  user_email TEXT NOT NULL,
  learner_name TEXT NOT NULL,
  course_code TEXT NOT NULL,
  course_title TEXT NOT NULL,
  issuer_name TEXT NOT NULL DEFAULT 'University of Cape Coast',
  requirements_json TEXT NOT NULL DEFAULT '{}',
  credential_type TEXT NOT NULL DEFAULT 'microcredential',
  status TEXT NOT NULL DEFAULT 'active',
  expires_at TEXT,
  revoked_at TEXT,
  revocation_reason TEXT,
  issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_email, course_code)
);
CREATE TABLE IF NOT EXISTS colab_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_code TEXT NOT NULL,
  title TEXT NOT NULL,
  instructions TEXT NOT NULL DEFAULT '',
  template_file_key TEXT NOT NULL,
  template_file_name TEXT NOT NULL,
  template_url TEXT,
  rubric TEXT NOT NULL DEFAULT '',
  max_mark INTEGER NOT NULL DEFAULT 100,
  pass_mark INTEGER NOT NULL DEFAULT 50,
  attempts_allowed INTEGER NOT NULL DEFAULT 1,
  due_at TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('draft','active','closed')),
  created_by_email TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS colab_assignments_course_idx ON colab_assignments(course_code);
CREATE INDEX IF NOT EXISTS colab_assignments_creator_idx ON colab_assignments(created_by_email);
CREATE TABLE IF NOT EXISTS colab_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER NOT NULL REFERENCES colab_assignments(id) ON DELETE CASCADE,
  learner_email TEXT NOT NULL,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  submission_type TEXT NOT NULL CHECK(submission_type IN ('file','link')),
  notebook_key TEXT,
  notebook_file_name TEXT,
  notebook_url TEXT,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','assessed','resubmit')),
  mark INTEGER,
  passed INTEGER NOT NULL DEFAULT 0,
  feedback TEXT NOT NULL DEFAULT '',
  assessed_by_email TEXT,
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  assessed_at TEXT,
  UNIQUE(assignment_id, learner_email, attempt_number)
);
CREATE INDEX IF NOT EXISTS colab_submissions_assignment_idx ON colab_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS colab_submissions_learner_idx ON colab_submissions(learner_email);
CREATE TABLE IF NOT EXISTS virtual_lab_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  practical_id TEXT NOT NULL,
  discipline TEXT NOT NULL,
  practical_title TEXT NOT NULL,
  learner_email TEXT NOT NULL,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  observations_json TEXT NOT NULL DEFAULT '[]',
  answers_json TEXT NOT NULL DEFAULT '{}',
  report TEXT NOT NULL DEFAULT '',
  evidence_key TEXT,
  evidence_file_name TEXT,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','assessed','resubmit')),
  mark INTEGER,
  passed INTEGER NOT NULL DEFAULT 0,
  feedback TEXT NOT NULL DEFAULT '',
  competency_note TEXT NOT NULL DEFAULT '',
  assessed_by_email TEXT,
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  assessed_at TEXT,
  UNIQUE(practical_id, learner_email, attempt_number)
);
CREATE INDEX IF NOT EXISTS virtual_lab_practical_idx ON virtual_lab_submissions(practical_id);
CREATE INDEX IF NOT EXISTS virtual_lab_learner_idx ON virtual_lab_submissions(learner_email);
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS admin_audit_log_admin_idx ON admin_audit_log(admin_email);
`;

const globalForDatabase = globalThis as typeof globalThis & {
  __uccRawDb?: RenderDatabase;
};

export function getRawDb() {
  if (globalForDatabase.__uccRawDb) return globalForDatabase.__uccRawDb;
  const dataDirectory = process.env.DATA_DIR || join(process.cwd(), ".data");
  const databasePath = process.env.SQLITE_PATH || join(dataDirectory, "ucc-microcredentials.sqlite");
  mkdirSync(dirname(databasePath), { recursive: true });
  const database = new DatabaseSync(databasePath);
  database.exec(schema);
  const ensureColumn = (table: string, column: string, definition: string) => {
    const columns = database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!columns.some((item) => item.name === column)) database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  };
  const courseColumns = database.prepare("PRAGMA table_info(course_drafts)").all() as { name: string }[];
  if (!courseColumns.some((column) => column.name === "activities_json")) {
    database.exec("ALTER TABLE course_drafts ADD COLUMN activities_json TEXT NOT NULL DEFAULT '[]'");
  }
  ensureColumn("course_drafts", "design_json", "TEXT NOT NULL DEFAULT '{}'");
  ensureColumn("course_drafts", "version_number", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn("course_drafts", "submitted_at", "TEXT");
  ensureColumn("course_drafts", "updated_at", "TEXT");
  ensureColumn("course_drafts", "review_comment", "TEXT");
  ensureColumn("course_drafts", "reviewed_by_email", "TEXT");
  ensureColumn("course_drafts", "reviewed_at", "TEXT");
  ensureColumn("users", "student_number", "TEXT");
  ensureColumn("users", "education_level", "TEXT");
  ensureColumn("users", "occupation", "TEXT");
  ensureColumn("users", "organisation", "TEXT");
  ensureColumn("users", "interests_json", "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn("users", "preferred_language", "TEXT NOT NULL DEFAULT 'English'");
  ensureColumn("users", "accessibility_needs", "TEXT");
  ensureColumn("users", "terms_accepted_at", "TEXT");
  ensureColumn("users", "privacy_accepted_at", "TEXT");
  ensureColumn("certificates", "credential_type", "TEXT NOT NULL DEFAULT 'microcredential'");
  ensureColumn("certificates", "issuer_name", "TEXT NOT NULL DEFAULT 'University of Cape Coast'");
  ensureColumn("certificates", "requirements_json", "TEXT NOT NULL DEFAULT '{}'");
  ensureColumn("certificates", "status", "TEXT NOT NULL DEFAULT 'active'");
  ensureColumn("certificates", "expires_at", "TEXT");
  ensureColumn("certificates", "revoked_at", "TEXT");
  ensureColumn("certificates", "revocation_reason", "TEXT");
  database.exec("UPDATE course_drafts SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP) WHERE updated_at IS NULL");
  database.exec("UPDATE users SET student_number = 'UCC-MC-' || strftime('%Y', created_at) || '-' || printf('%06d', id) WHERE role = 'learner' AND (student_number IS NULL OR student_number = '')");
  globalForDatabase.__uccRawDb = new RenderDatabase(database);
  return globalForDatabase.__uccRawDb;
}
