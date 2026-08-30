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
  gate_required INTEGER NOT NULL DEFAULT 1,
  question_limit INTEGER NOT NULL DEFAULT 10,
  certificate_enabled INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending_review',
  created_by_email TEXT NOT NULL DEFAULT '',
  activated_by_email TEXT,
  activated_at TEXT,
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
  const courseColumns = database.prepare("PRAGMA table_info(course_drafts)").all() as { name: string }[];
  if (!courseColumns.some((column) => column.name === "activities_json")) {
    database.exec("ALTER TABLE course_drafts ADD COLUMN activities_json TEXT NOT NULL DEFAULT '[]'");
  }
  globalForDatabase.__uccRawDb = new RenderDatabase(database);
  return globalForDatabase.__uccRawDb;
}
