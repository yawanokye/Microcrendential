import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";

const backupDir = resolve(process.env.BACKUP_DIR || join(process.env.DATA_DIR || join(process.cwd(), ".data"), "backups"));
const requested = process.argv[2] ? resolve(process.argv[2]) : "";
const candidates = existsSync(backupDir) ? readdirSync(backupDir).filter((name) => name.endsWith(".tar.gz")).sort().reverse() : [];
const archive = requested || (candidates[0] ? join(backupDir, candidates[0]) : "");
if (!archive || !existsSync(archive)) throw new Error("No backup archive was found.");
const checksumFile = `${archive}.sha256`;
if (!existsSync(checksumFile)) throw new Error("The checksum sidecar is missing.");
const expected = readFileSync(checksumFile, "utf8").trim().split(/\s+/)[0];
const actual = createHash("sha256").update(readFileSync(archive)).digest("hex");
if (expected !== actual) throw new Error("Backup checksum verification failed.");
const target = mkdtempSync(join(tmpdir(), "ucc-growthplus-verify-"));
try {
  execFileSync("tar", ["-xzf", archive, "-C", target], { stdio: "ignore" });
  const database = new DatabaseSync(join(target, "ucc-microcredentials.sqlite"), { readOnly: true });
  const integrity = String(database.prepare("PRAGMA integrity_check").get()?.integrity_check || "unknown");
  const users = Number(database.prepare("SELECT COUNT(*) AS total FROM users").get()?.total || 0);
  const certificates = Number(database.prepare("SELECT COUNT(*) AS total FROM certificates").get()?.total || 0);
  database.close();
  if (integrity !== "ok") throw new Error(`SQLite integrity check returned ${integrity}.`);
  console.log(JSON.stringify({ status: "verified", archive, checksum: actual, databaseIntegrity: integrity, users, certificates }));
} finally {
  rmSync(target, { recursive: true, force: true });
}
