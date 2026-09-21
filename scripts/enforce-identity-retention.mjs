import { existsSync, rmSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";

const dataDir = resolve(process.env.DATA_DIR || join(process.cwd(), ".data"));
const databasePath = resolve(process.env.SQLITE_PATH || join(dataDir, "ucc-microcredentials.sqlite"));
const uploadsRoot = resolve(join(dataDir, "uploads"));
const retentionDays = Number(process.env.IDENTITY_RETENTION_DAYS || 90);
if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 365) throw new Error("IDENTITY_RETENTION_DAYS must be between 1 and 365.");
if (!existsSync(databasePath)) process.exit(0);
const database = new DatabaseSync(databasePath);
const rows = database.prepare("SELECT email,id_document_key,selfie_key FROM users WHERE reviewed_at IS NOT NULL AND datetime(reviewed_at) < datetime('now', ?) AND (id_document_key IS NOT NULL OR selfie_key IS NOT NULL)")
  .all(`-${retentionDays} days`);
const removeKey = (key) => {
  if (!key) return;
  const target = resolve(uploadsRoot, String(key));
  if (!target.startsWith(`${uploadsRoot}${sep}`)) throw new Error("Unsafe identity file path.");
  rmSync(target, { force: true });
  rmSync(`${target}.json`, { force: true });
};
database.exec("BEGIN IMMEDIATE");
try {
  const update = database.prepare("UPDATE users SET id_document_key = NULL, selfie_key = NULL WHERE email = ?");
  const audit = database.prepare("INSERT INTO admin_audit_log (admin_email,action,details_json) VALUES (?,'identity.evidence_retained_then_deleted',?)");
  for (const row of rows) {
    removeKey(row.id_document_key); removeKey(row.selfie_key);
    update.run(row.email);
    audit.run("system", JSON.stringify({ learnerEmail: row.email, retentionDays }));
  }
  database.exec("COMMIT");
  console.log(JSON.stringify({ status: "completed", recordsCleaned: rows.length, retentionDays }));
} catch (error) {
  database.exec("ROLLBACK");
  throw error;
} finally { database.close(); }
