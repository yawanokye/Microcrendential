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
  certificate_preapproved INTEGER NOT NULL DEFAULT 0,
  approval_authority TEXT,
  approval_meeting_date TEXT,
  approval_reference TEXT,
  approval_decision TEXT,
  approval_conditions TEXT,
  approval_conditions_satisfied INTEGER NOT NULL DEFAULT 0,
  approval_effective_date TEXT,
  approval_review_date TEXT,
  approval_document_reference TEXT,
  approval_recorded_by_email TEXT,
  approval_recorded_at TEXT,
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
CREATE TABLE IF NOT EXISTS payment_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT NOT NULL UNIQUE,
  user_email TEXT NOT NULL,
  course_code TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK(purpose IN ('enrollment','certificate')),
  amount_pesewas INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GHS',
  provider TEXT NOT NULL DEFAULT 'paystack',
  status TEXT NOT NULL DEFAULT 'initialized' CHECK(status IN ('initialized','paid','failed','cancelled')),
  provider_data_json TEXT NOT NULL DEFAULT '{}',
  paid_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS payment_orders_user_idx ON payment_orders(user_email);
CREATE INDEX IF NOT EXISTS payment_orders_course_idx ON payment_orders(course_code);
CREATE TABLE IF NOT EXISTS platform_migrations (
  migration_key TEXT PRIMARY KEY NOT NULL,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
CREATE TABLE IF NOT EXISTS assessment_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_email TEXT NOT NULL,
  course_code TEXT NOT NULL,
  attempt_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','awaiting_marking','marked','resubmit')),
  auto_score INTEGER,
  final_score INTEGER,
  passed INTEGER NOT NULL DEFAULT 0,
  answers_json TEXT NOT NULL DEFAULT '{}',
  auto_feedback_json TEXT NOT NULL DEFAULT '[]',
  marker_feedback TEXT NOT NULL DEFAULT '',
  marked_by_email TEXT,
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  marked_at TEXT,
  UNIQUE(user_email, course_code, attempt_number)
);
CREATE INDEX IF NOT EXISTS assessment_submissions_course_idx ON assessment_submissions(course_code,status);
CREATE TABLE IF NOT EXISTS learning_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_email TEXT NOT NULL,
  course_code TEXT NOT NULL,
  material_id TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  last_position INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_email,course_code,material_id)
);
CREATE TABLE IF NOT EXISTS material_activity_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_email TEXT NOT NULL,
  course_code TEXT NOT NULL,
  material_id TEXT NOT NULL,
  activity_id TEXT NOT NULL,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  response_type TEXT NOT NULL DEFAULT 'long_text',
  response_text TEXT NOT NULL DEFAULT '',
  evidence_key TEXT,
  evidence_file_name TEXT,
  evidence_mime_type TEXT,
  status TEXT NOT NULL DEFAULT 'assessed' CHECK(status IN ('submitted','assessed','resubmit')),
  mark INTEGER,
  max_mark INTEGER NOT NULL DEFAULT 100,
  pass_mark INTEGER NOT NULL DEFAULT 60,
  passed INTEGER NOT NULL DEFAULT 0,
  feedback TEXT NOT NULL DEFAULT '',
  criteria_json TEXT NOT NULL DEFAULT '[]',
  grading_mode TEXT NOT NULL DEFAULT 'ai_auto',
  model TEXT,
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  assessed_at TEXT,
  UNIQUE(user_email, course_code, activity_id, attempt_number)
);
CREATE INDEX IF NOT EXISTS material_activity_learner_idx ON material_activity_submissions(user_email,course_code,activity_id);
CREATE INDEX IF NOT EXISTS material_activity_course_idx ON material_activity_submissions(course_code,activity_id,passed);
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
  UNIQUE(course_id,revision_number)
);
CREATE TABLE IF NOT EXISTS login_rate_limits (
  rate_key TEXT PRIMARY KEY NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  window_started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  blocked_until TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS certificate_signatures (
  signature_key TEXT PRIMARY KEY NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('facilitator','provost')),
  owner_email TEXT,
  signatory_name TEXT NOT NULL,
  signatory_title TEXT NOT NULL,
  file_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  uploaded_by_email TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS certificates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  certificate_code TEXT NOT NULL UNIQUE,
  user_email TEXT NOT NULL,
  learner_name TEXT NOT NULL,
  course_code TEXT NOT NULL,
  course_title TEXT NOT NULL,
  issuer_name TEXT NOT NULL DEFAULT 'University of Cape Coast',
  award_type TEXT NOT NULL DEFAULT 'microcredential_achievement',
  issuance_model TEXT NOT NULL DEFAULT 'ucc_issued',
  partner_name TEXT,
  partner_logo_key TEXT,
  partner_signatory_name TEXT,
  partner_signatory_title TEXT,
  partner_signature_key TEXT,
  cpd_hours REAL NOT NULL DEFAULT 0,
  cpd_points REAL NOT NULL DEFAULT 0,
  professional_approval_body TEXT,
  professional_approval_reference TEXT,
  show_academic_lead INTEGER NOT NULL DEFAULT 0,
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
  section_id TEXT,
  grading_mode TEXT NOT NULL DEFAULT 'facilitator',
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

  // `course_revisions` existed in an older release with a different shape
  // (`base_version_number`, `payload_json`, `version_number`, status='approved').
  // CREATE TABLE IF NOT EXISTS cannot upgrade that table, and adding only the new
  // columns would leave the legacy CHECK constraint in place. Rebuild it once so
  // existing Render SQLite disks are upgraded in place without losing revisions.
  const revisionColumns = database.prepare("PRAGMA table_info(course_revisions)").all() as { name: string }[];
  const revisionColumnNames = new Set(revisionColumns.map((item) => item.name));
  const revisionTableSql = (database.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='course_revisions'").get() as { sql?: string } | undefined)?.sql ?? "";
  const revisionSchemaIsCanonical = revisionColumnNames.has("revision_number")
    && revisionColumnNames.has("snapshot_json")
    && revisionColumnNames.has("applied_at")
    && revisionTableSql.includes("'applied'");

  if (!revisionSchemaIsCanonical) {
    const legacyRows = database.prepare("SELECT * FROM course_revisions ORDER BY course_id, id").all() as Record<string, unknown>[];
    database.exec("DROP TABLE IF EXISTS course_revisions_next");
    database.exec(`
      CREATE TABLE course_revisions_next (
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
        UNIQUE(course_id,revision_number)
      );
    `);
    const insertRevision = database.prepare(`INSERT INTO course_revisions_next (
      id,course_id,revision_number,snapshot_json,status,created_by_email,review_comment,reviewed_by_email,submitted_at,reviewed_at,applied_at,updated_at,created_at,
      approval_authority,approval_meeting_date,approval_reference,approval_recorded_by_email,approval_recorded_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const perCourseRevision = new Map<number, number>();
    database.exec("BEGIN IMMEDIATE");
    try {
      for (const row of legacyRows) {
        const courseId = Number(row.course_id);
        const fallbackNumber = (perCourseRevision.get(courseId) ?? 0) + 1;
        const requestedNumber = Number(row.revision_number);
        const revisionNumber = Number.isInteger(requestedNumber) && requestedNumber > 0 ? requestedNumber : fallbackNumber;
        perCourseRevision.set(courseId, Math.max(fallbackNumber, revisionNumber));
        const legacyStatus = String(row.status ?? "draft");
        const status = legacyStatus === "approved" ? "applied" : ["draft","pending_review","rejected","applied","withdrawn"].includes(legacyStatus) ? legacyStatus : "draft";
        const snapshot = String(row.snapshot_json ?? row.payload_json ?? "{}");
        insertRevision.run(
          Number(row.id), courseId, revisionNumber, snapshot, status, String(row.created_by_email ?? ""),
          row.review_comment == null ? null : String(row.review_comment),
          row.reviewed_by_email == null ? null : String(row.reviewed_by_email),
          row.submitted_at == null ? null : String(row.submitted_at),
          row.reviewed_at == null ? null : String(row.reviewed_at),
          row.applied_at == null && row.approved_at == null ? null : String(row.applied_at ?? row.approved_at),
          row.updated_at == null && row.created_at == null ? null : String(row.updated_at ?? row.created_at),
          row.created_at == null ? null : String(row.created_at),
          row.approval_authority == null ? null : String(row.approval_authority),
          row.approval_meeting_date == null ? null : String(row.approval_meeting_date),
          row.approval_reference == null ? null : String(row.approval_reference),
          row.approval_recorded_by_email == null ? null : String(row.approval_recorded_by_email),
          row.approval_recorded_at == null ? null : String(row.approval_recorded_at)
        );
      }
      database.exec("DROP TABLE course_revisions");
      database.exec("ALTER TABLE course_revisions_next RENAME TO course_revisions");
      database.exec("CREATE INDEX IF NOT EXISTS course_revisions_course_idx ON course_revisions(course_id)");
      database.exec("CREATE INDEX IF NOT EXISTS course_revisions_creator_idx ON course_revisions(created_by_email)");
      database.exec("CREATE INDEX IF NOT EXISTS course_revisions_status_idx ON course_revisions(status)");
      database.exec("INSERT OR IGNORE INTO platform_migrations (migration_key) VALUES ('0016_course_revisions_canonical_schema')");
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      try { database.exec("DROP TABLE IF EXISTS course_revisions_next"); } catch {}
      throw error;
    }
  } else {
    database.exec("INSERT OR IGNORE INTO platform_migrations (migration_key) VALUES ('0016_course_revisions_canonical_schema')");
  }
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
  ensureColumn("course_drafts", "certificate_preapproved", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("course_drafts", "approval_authority", "TEXT");
  ensureColumn("course_drafts", "approval_meeting_date", "TEXT");
  ensureColumn("course_drafts", "approval_reference", "TEXT");
  ensureColumn("course_drafts", "approval_decision", "TEXT");
  ensureColumn("course_drafts", "approval_conditions", "TEXT");
  ensureColumn("course_drafts", "approval_conditions_satisfied", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("course_drafts", "approval_effective_date", "TEXT");
  ensureColumn("course_drafts", "approval_review_date", "TEXT");
  ensureColumn("course_drafts", "approval_document_reference", "TEXT");
  ensureColumn("course_drafts", "approval_recorded_by_email", "TEXT");
  ensureColumn("course_drafts", "approval_recorded_at", "TEXT");
  ensureColumn("course_revisions", "approval_authority", "TEXT");
  ensureColumn("course_revisions", "approval_meeting_date", "TEXT");
  ensureColumn("course_revisions", "approval_reference", "TEXT");
  ensureColumn("course_revisions", "approval_recorded_by_email", "TEXT");
  ensureColumn("course_revisions", "approval_recorded_at", "TEXT");
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
  ensureColumn("certificates", "award_type", "TEXT NOT NULL DEFAULT 'microcredential_achievement'");
  ensureColumn("certificates", "issuance_model", "TEXT NOT NULL DEFAULT 'ucc_issued'");
  ensureColumn("certificates", "partner_name", "TEXT");
  ensureColumn("certificates", "partner_logo_key", "TEXT");
  ensureColumn("certificates", "partner_signatory_name", "TEXT");
  ensureColumn("certificates", "partner_signatory_title", "TEXT");
  ensureColumn("certificates", "partner_signature_key", "TEXT");
  ensureColumn("certificates", "cpd_hours", "REAL NOT NULL DEFAULT 0");
  ensureColumn("certificates", "cpd_points", "REAL NOT NULL DEFAULT 0");
  ensureColumn("certificates", "professional_approval_body", "TEXT");
  ensureColumn("certificates", "professional_approval_reference", "TEXT");
  ensureColumn("certificates", "show_academic_lead", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("certificates", "requirements_json", "TEXT NOT NULL DEFAULT '{}'");
  ensureColumn("certificates", "status", "TEXT NOT NULL DEFAULT 'active'");
  ensureColumn("certificates", "expires_at", "TEXT");
  ensureColumn("certificates", "revoked_at", "TEXT");
  ensureColumn("certificates", "revocation_reason", "TEXT");
  ensureColumn("certificates", "facilitator_name", "TEXT");
  ensureColumn("certificates", "facilitator_title", "TEXT");
  ensureColumn("certificates", "facilitator_signature_key", "TEXT");
  ensureColumn("certificates", "provost_name", "TEXT");
  ensureColumn("certificates", "provost_title", "TEXT");
  ensureColumn("certificates", "provost_signature_key", "TEXT");
  ensureColumn("certificates", "credit_value", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("certificates", "learning_mode", "TEXT NOT NULL DEFAULT 'blended'");
  ensureColumn("colab_assignments", "section_id", "TEXT");
  ensureColumn("colab_assignments", "grading_mode", "TEXT NOT NULL DEFAULT 'facilitator'");
  const selfEnrolmentMigration = database.prepare("SELECT migration_key FROM platform_migrations WHERE migration_key = '0014_existing_courses_self_enrolment'").get() as { migration_key?: string } | undefined;
  const certificatePreapprovalMigration = database.prepare("SELECT migration_key FROM platform_migrations WHERE migration_key = '0015_existing_active_certificate_preapproval'").get() as { migration_key?: string } | undefined;
  if (!certificatePreapprovalMigration) {
    database.exec("UPDATE course_drafts SET certificate_preapproved = 1 WHERE status = 'active' AND certificate_enabled = 1");
    database.exec("INSERT INTO platform_migrations (migration_key) VALUES ('0015_existing_active_certificate_preapproval')");
  }
  if (!selfEnrolmentMigration) {
    database.exec(`UPDATE course_drafts
      SET design_json = CASE
        WHEN json_valid(design_json) THEN json_set(design_json, '$.enrolmentMode', 'open')
        ELSE '{"enrolmentMode":"open","priceGhs":0,"certificateFeeGhs":0}'
      END`);
    database.exec("INSERT INTO platform_migrations (migration_key) VALUES ('0014_existing_courses_self_enrolment')");
  }
  database.exec("UPDATE course_drafts SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP) WHERE updated_at IS NULL");
  database.exec("UPDATE users SET student_number = 'UCC-MC-' || strftime('%Y', created_at) || '-' || printf('%06d', id) WHERE role = 'learner' AND (student_number IS NULL OR student_number = '')");
  globalForDatabase.__uccRawDb = new RenderDatabase(database);
  return globalForDatabase.__uccRawDb;
}
