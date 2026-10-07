import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";

const dataDir = resolve(process.env.DATA_DIR || join(process.cwd(), ".data"));
const databasePath = resolve(process.env.SQLITE_PATH || join(dataDir, "ucc-microcredentials.sqlite"));
const backupDir = resolve(process.env.BACKUP_DIR || join(dataDir, "backups"));
const retentionDays = Math.min(90, Math.max(2, Number(process.env.BACKUP_RETENTION_DAYS || 14)));

if (backupDir === "/" || backupDir === dataDir || !backupDir.startsWith(`${dataDir}${sep}`)) throw new Error("BACKUP_DIR must be a dedicated directory below DATA_DIR.");
if (!existsSync(databasePath)) throw new Error(`Database not found at ${databasePath}.`);

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const archive = join(backupDir, `ucc-growthplus-${stamp}.tar.gz`);
let working;

const countFiles = (directory) => {
  if (!existsSync(directory)) return 0;
  return readdirSync(directory, { withFileTypes: true }).reduce((total, entry) => total + (entry.isDirectory() ? countFiles(join(directory, entry.name)) : 1), 0);
};

const source = new DatabaseSync(databasePath);
source.exec(`CREATE TABLE IF NOT EXISTS backup_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  backup_file TEXT NOT NULL,
  checksum TEXT NOT NULL,
  database_integrity TEXT NOT NULL,
  upload_files INTEGER NOT NULL DEFAULT 0,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK(status IN ('completed','failed')),
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`);

try {
  // Keep filesystem setup inside the failure-recording boundary. A mounted
  // disk permission failure must be visible in the administrator's register.
  mkdirSync(backupDir, { recursive: true });
  working = mkdtempSync(join(backupDir, `.in-progress-${stamp}-`));
  const snapshot = join(working, "snapshot");
  const snapshotDatabase = join(snapshot, "ucc-microcredentials.sqlite");
  mkdirSync(snapshot);
  source.exec("PRAGMA wal_checkpoint(PASSIVE)");
  const escaped = snapshotDatabase.replaceAll("'", "''");
  source.exec(`VACUUM INTO '${escaped}'`);
  const uploads = join(dataDir, "uploads");
  if (existsSync(uploads)) cpSync(uploads, join(snapshot, "uploads"), { recursive: true });
  const uploadFiles = countFiles(join(snapshot, "uploads"));
  writeFileSync(join(snapshot, "manifest.json"), JSON.stringify({ createdAt: new Date().toISOString(), databaseFile: basename(snapshotDatabase), uploadFiles, source: "UCC Growth+ official pilot" }, null, 2));
  execFileSync("tar", ["-czf", archive, "-C", snapshot, "."], { stdio: "ignore" });
  const checksum = createHash("sha256").update(readFileSync(archive)).digest("hex");
  writeFileSync(`${archive}.sha256`, `${checksum}  ${basename(archive)}\n`, "utf8");
  const verifyDb = new DatabaseSync(snapshotDatabase, { readOnly: true });
  const integrity = String(verifyDb.prepare("PRAGMA integrity_check").get()?.integrity_check || "unknown");
  verifyDb.close();
  if (integrity !== "ok") throw new Error(`Backup database integrity check returned ${integrity}.`);
  const size = statSync(archive).size;
  source.prepare("INSERT INTO backup_runs (backup_file,checksum,database_integrity,upload_files,size_bytes,status,details_json) VALUES (?,?,?,?,?,'completed',?)")
    .run(basename(archive), checksum, integrity, uploadFiles, size, JSON.stringify({ retentionDays }));
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  for (const entry of readdirSync(backupDir, { withFileTypes: true })) {
    if (!entry.isFile() || !/^ucc-growthplus-.*\.(tar\.gz|tar\.gz\.sha256)$/.test(entry.name)) continue;
    const path = join(backupDir, entry.name);
    if (statSync(path).mtimeMs < cutoff) rmSync(path, { force: true });
  }
  console.log(JSON.stringify({ status: "completed", archive, checksum, integrity, uploadFiles, sizeBytes: size }));
} catch (error) {
  const details = { error: error instanceof Error ? error.message : String(error), code: error?.code };
  try {
    source.prepare("INSERT INTO backup_runs (backup_file,checksum,database_integrity,status,details_json) VALUES (?,'','failed','failed',?)")
      .run(basename(archive), JSON.stringify(details));
  } catch (recordError) {
    console.error(JSON.stringify({ status: "failed", operation: "backup.record_failure", error: recordError.message }));
  }
  console.error(JSON.stringify({ status: "failed", operation: "backup", ...details }));
  process.exitCode = 1;
} finally {
  source.close();
  if (working) {
    try { rmSync(working, { recursive: true, force: true }); }
    catch (error) { console.error(JSON.stringify({ status: "failed", operation: "backup.cleanup", error: error.message })); }
  }
}
