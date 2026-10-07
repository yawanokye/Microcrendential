import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, chownSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { pathToFileURL } from "node:url";

const project = resolve(import.meta.dirname, "..");
const privileged = process.getuid?.() === 0;
let canMigrateOwnership = false;
if (privileged && process.platform === "linux") {
  const status = readFileSync("/proc/self/status", "utf8");
  const capabilities = BigInt(`0x${status.match(/^CapEff:\s*([0-9a-f]+)$/m)?.[1] || "0"}`);
  const identityCapabilities = BigInt(0xc1); // CHOWN, SETGID and SETUID.
  const mapped = (path: string) => readFileSync(path, "utf8").trim().split("\n").some((line) => {
    const [start, , count] = line.trim().split(/\s+/).map(Number);
    return 1001 >= start && 1001 < start + count;
  });
  canMigrateOwnership = (capabilities & identityCapabilities) === identityCapabilities && mapped("/proc/self/uid_map") && mapped("/proc/self/gid_map");
}
const rootOnly = { skip: canMigrateOwnership ? false : "Requires CHOWN, SETUID and SETGID capabilities, unavailable in this workspace." };

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "ucc-pilot-storage-"));
  chmodSync(directory, 0o755);
  const dataDir = join(directory, "data");
  const backupDir = join(dataDir, "backups");
  const uploads = join(dataDir, "uploads");
  const databasePath = join(dataDir, "ucc-microcredentials.sqlite");
  mkdirSync(backupDir, { recursive: true });
  mkdirSync(uploads);
  writeFileSync(join(uploads, "signature.txt"), "stored-signature");
  const db = new DatabaseSync(databasePath);
  db.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT); INSERT INTO users VALUES (1, 'learner@example.com'); CREATE TABLE certificates (id INTEGER PRIMARY KEY); INSERT INTO certificates VALUES (1);");
  db.close();
  return {
    directory, dataDir, backupDir, uploads, databasePath,
    env: { ...process.env, DATA_DIR: dataDir, SQLITE_PATH: databasePath, BACKUP_DIR: backupDir },
    cleanup: () => rmSync(directory, { recursive: true, force: true }),
  };
}

function entrypoint(env: NodeJS.ProcessEnv, args: string[]) {
  return spawnSync(process.execPath, ["scripts/pilot-entrypoint.mjs", process.execPath, ...args], {
    cwd: project, env, encoding: "utf8", timeout: 15_000,
  });
}

test("entrypoint orders scoped ownership repair before privilege drop and server launch", () => {
  const f = fixture();
  try {
    const external = join(f.directory, "external.txt");
    writeFileSync(external, "outside-storage");
    symlinkSync(external, join(f.uploads, "external-link"));
    chmodSync(f.backupDir, 0o500);
    const url = pathToFileURL(join(project, "scripts/pilot-entrypoint.mjs")).href;
    // Exercise the real startup code with identity/ownership spies. The real
    // OS migration tests below also run on hosts with the required capabilities.
    const runner = `
      import fs from 'node:fs';
      import childProcess from 'node:child_process';
      import { EventEmitter } from 'node:events';
      import { syncBuiltinESMExports } from 'node:module';
      const calls = [];
      let uid = 0, gid = 0;
      fs.chownSync = (path, owner, group) => calls.push({operation:'chown',path,owner,group});
      process.getuid = () => uid;
      process.getgid = () => gid;
      process.setgroups = groups => calls.push({operation:'setgroups',groups});
      process.setgid = value => { gid = value; calls.push({operation:'setgid',gid}); };
      process.setuid = value => { uid = value; calls.push({operation:'setuid',uid}); };
      childProcess.spawn = () => {
        calls.push({operation:'spawn',uid,gid});
        console.log(JSON.stringify({calls}));
        const child = new EventEmitter();
        child.kill = () => true;
        setImmediate(() => child.emit('exit',0,null));
        return child;
      };
      syncBuiltinESMExports();
      process.argv = [process.execPath, ${JSON.stringify(join(project, "scripts/pilot-entrypoint.mjs"))}, process.execPath, '-e', 'process.exit(0)'];
      await import(${JSON.stringify(url)});
    `;
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", runner], { cwd: project, env: f.env, encoding: "utf8", timeout: 15_000 });
    assert.equal(result.status, 0, result.stderr);
    const { calls } = JSON.parse(result.stdout.trim().split("\n").at(-1)!);
    const repairs = calls.filter((call: { operation: string }) => call.operation === "chown");
    for (const path of [f.dataDir, f.backupDir, f.uploads, f.databasePath, join(f.uploads, "signature.txt")]) {
      assert.ok(repairs.some((call: { path: string; owner: number; group: number }) => call.path === path && call.owner === 1001 && call.group === 1001));
    }
    assert.ok(!repairs.some((call: { path: string }) => call.path === external));
    assert.deepEqual(calls.slice(-4), [
      { operation: "setgroups", groups: [] }, { operation: "setgid", gid: 1001 },
      { operation: "setuid", uid: 1001 }, { operation: "spawn", uid: 1001, gid: 1001 },
    ]);
    assert.equal(statSync(f.backupDir).mode & 0o700, 0o700);
    assert.equal(readFileSync(external, "utf8"), "outside-storage");
  } finally { chmodSync(f.backupDir, 0o755); f.cleanup(); }
});

test("mounted root-owned storage is repaired before the server runs without root", rootOnly, () => {
  const f = fixture();
  try {
    chmodSync(f.dataDir, 0o700);
    const result = entrypoint(f.env, ["--input-type=module", "-e", "console.log(JSON.stringify({uid:process.getuid(),gid:process.getgid(),groups:process.getgroups()}))"]);
    assert.equal(result.status, 0, result.stderr);
    const identity = JSON.parse(result.stdout.trim().split("\n").at(-1)!);
    assert.equal(identity.uid, 1001);
    assert.equal(identity.gid, 1001);
    assert.ok(!identity.groups.includes(0));
    for (const path of [f.dataDir, f.backupDir, f.uploads, f.databasePath, join(f.uploads, "signature.txt")]) assert.equal(statSync(path).uid, 1001);
    assert.equal(readFileSync(join(f.uploads, "signature.txt"), "utf8"), "stored-signature");
    const db = new DatabaseSync(f.databasePath, { readOnly: true });
    assert.equal(db.prepare("SELECT email FROM users").get()?.email, "learner@example.com");
    db.close();
  } finally { f.cleanup(); }
});

test("ownership repair leaves a nested symlink's external target untouched", rootOnly, () => {
  const f = fixture();
  try {
    const external = join(f.directory, "external.txt");
    writeFileSync(external, "outside-storage");
    symlinkSync(external, join(f.uploads, "external-link"));
    const result = entrypoint(f.env, ["-e", "process.exit(0)"]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(statSync(external).uid, 0);
    assert.equal(readFileSync(external, "utf8"), "outside-storage");
  } finally { f.cleanup(); }
});

test("storage initialization rejects system roots before making changes", () => {
  const result = entrypoint({ ...process.env, DATA_DIR: "/" }, ["-e", "process.exit(0)"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /dedicated application-storage directory/);
});

test("storage initialization rejects a backup directory outside DATA_DIR", () => {
  const f = fixture();
  try {
    const result = entrypoint({ ...f.env, BACKUP_DIR: join(f.directory, "outside") }, ["-e", "process.exit(0)"]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /BACKUP_DIR must be below DATA_DIR/);
    assert.equal(existsSync(join(f.directory, "outside")), false);
  } finally { f.cleanup(); }
});

test("backup succeeds as the unprivileged user after mounted-storage repair", rootOnly, () => {
  const f = fixture();
  try {
    const result = entrypoint(f.env, ["scripts/pilot-backup.mjs"]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /"status":"completed"/);
    assert.equal(readdirSync(f.backupDir).filter((name) => name.startsWith(".in-progress-")).length, 0);
    const verified = entrypoint(f.env, ["scripts/verify-backup.mjs"]);
    assert.equal(verified.status, 0, verified.stderr);
    assert.match(verified.stdout, /"databaseIntegrity":"ok"/);
    assert.match(verified.stdout, /"users":1,"certificates":1/);
    const db = new DatabaseSync(f.databasePath, { readOnly: true });
    assert.equal(db.prepare("SELECT status FROM backup_runs ORDER BY id DESC LIMIT 1").get()?.status, "completed");
    db.close();
  } finally { f.cleanup(); }
});

test("a backup-directory permission failure is recorded without a misleading success", () => {
  const f = fixture();
  try {
    // Reproduce the deployed state: the database is writable, older backups
    // remain root-owned, and the non-root process cannot create a snapshot.
    if (canMigrateOwnership) {
      chownSync(f.dataDir, 1001, 1001);
      chownSync(f.databasePath, 1001, 1001);
      chmodSync(f.dataDir, 0o700);
      chmodSync(f.backupDir, 0o755);
    } else chmodSync(f.backupDir, 0o555);
    const result = spawnSync(process.execPath, ["scripts/pilot-backup.mjs"], {
      cwd: project, env: f.env, ...(canMigrateOwnership ? { uid: 1001, gid: 1001 } : {}), encoding: "utf8", timeout: 15_000,
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /"code":"EACCES"/);
    assert.doesNotMatch(result.stdout, /"status":"completed"/);
    const db = new DatabaseSync(f.databasePath, { readOnly: true });
    const row = db.prepare("SELECT status, details_json FROM backup_runs ORDER BY id DESC LIMIT 1").get();
    assert.equal(row?.status, "failed");
    assert.equal(JSON.parse(String(row?.details_json)).code, "EACCES");
    db.close();
  } finally { chmodSync(f.backupDir, 0o755); f.cleanup(); }
});

test("a writable storage directory produces a verified database-and-upload archive", () => {
  const f = fixture();
  try {
    const result = spawnSync(process.execPath, ["scripts/pilot-backup.mjs"], { cwd: project, env: f.env, encoding: "utf8", timeout: 15_000 });
    assert.equal(result.status, 0, result.stderr);
    const verified = spawnSync(process.execPath, ["scripts/verify-backup.mjs"], { cwd: project, env: f.env, encoding: "utf8", timeout: 15_000 });
    assert.equal(verified.status, 0, verified.stderr);
    assert.match(verified.stdout, /"databaseIntegrity":"ok"/);
    assert.match(verified.stdout, /"users":1,"certificates":1/);
    assert.equal(readdirSync(f.backupDir).filter((name) => name.startsWith(".in-progress-")).length, 0);
  } finally { f.cleanup(); }
});

for (const backupStatus of [0, 1]) {
  test(`retention ${backupStatus === 0 ? "runs after a completed" : "is skipped after a failed"} backup`, () => {
    const directory = mkdtempSync(join(tmpdir(), "ucc-pilot-maintenance-"));
    try {
      mkdirSync(join(directory, "scripts"));
      copyFileSync(join(project, "scripts/pilot-server.mjs"), join(directory, "scripts/pilot-server.mjs"));
      writeFileSync(join(directory, "server.js"), "setTimeout(() => process.exit(0), 700);");
      writeFileSync(join(directory, "scripts/pilot-backup.mjs"), `process.exit(${backupStatus});`);
      writeFileSync(join(directory, "scripts/enforce-identity-retention.mjs"), "console.log('retention-ran');");
      const url = pathToFileURL(join(directory, "scripts/pilot-server.mjs")).href;
      const runner = `globalThis.setTimeout = fn => { setImmediate(fn); return {unref(){}}; }; globalThis.setInterval = () => ({unref(){}}); await import(${JSON.stringify(url)});`;
      const result = spawnSync(process.execPath, ["--input-type=module", "-e", runner], {
        cwd: directory, env: { ...process.env, AUTO_BACKUP_ENABLED: "true" }, encoding: "utf8", timeout: 10_000,
      });
      assert.equal(result.status, 0, result.stderr);
      if (backupStatus === 0) assert.match(result.stdout, /retention-ran/);
      else {
        assert.doesNotMatch(result.stdout, /retention-ran/);
        assert.match(result.stderr, /maintenance.retention_skipped/);
      }
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
}
