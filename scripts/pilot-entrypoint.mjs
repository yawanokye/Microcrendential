import { spawn } from "node:child_process";
import { accessSync, chmodSync, chownSync, constants, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

const runtimeUid = 1001;
const runtimeGid = 1001;
const dataDir = resolve(process.env.DATA_DIR || "/var/data");
const databasePath = resolve(process.env.SQLITE_PATH || join(dataDir, "ucc-microcredentials.sqlite"));
const backupDir = resolve(process.env.BACKUP_DIR || join(dataDir, "backups"));
const uploadsDir = join(dataDir, "uploads");
const protectedRoots = ["/", "/app", "/var", "/var/lib", "/tmp", "/workspace", "/workspace/scratch", process.cwd()];
const protectedTrees = ["/etc", "/proc", "/sys", "/dev", "/usr", "/bin", "/sbin", "/lib", "/lib64", "/boot", "/root", "/home"];

function assertStoragePath(path, label) {
  if (path === dataDir || !path.startsWith(`${dataDir}${sep}`)) throw new Error(`${label} must be below DATA_DIR.`);
  // Do not follow links to storage outside the application's data directory.
  let current = dataDir;
  for (const part of relative(dataDir, path).split(sep)) {
    current = join(current, part);
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) throw new Error(`${label} must not use a symbolic link.`);
  }
}

function repairOwnership(path, recursive = false) {
  if (!existsSync(path)) return;
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) return;
  if (stat.uid !== runtimeUid || stat.gid !== runtimeGid) chownSync(path, runtimeUid, runtimeGid);
  const permissions = stat.mode & 0o777;
  const required = stat.isDirectory() ? 0o700 : 0o600;
  if ((permissions & required) !== required) chmodSync(path, permissions | required);
  if (recursive && stat.isDirectory()) {
    for (const name of readdirSync(path)) repairOwnership(join(path, name), true);
  }
}

function verifyWritable(directory) {
  let probe;
  try {
    probe = mkdtempSync(join(directory, ".permission-check-"));
    mkdirSync(join(probe, "snapshot"));
  } catch (error) {
    throw new Error(`Application user cannot write ${directory}. Check persistent-disk ownership and the Docker entrypoint.`, { cause: error });
  } finally {
    if (probe) rmSync(probe, { recursive: true, force: true });
  }
}

try {
  if (protectedRoots.includes(dataDir) || protectedTrees.some((path) => dataDir === path || dataDir.startsWith(`${path}${sep}`))) {
    throw new Error("DATA_DIR must be a dedicated application-storage directory, not a system or application root.");
  }
  mkdirSync(dataDir, { recursive: true });
  if (realpathSync(dataDir) !== dataDir) throw new Error("DATA_DIR must not use a symbolic link.");
  assertStoragePath(databasePath, "SQLITE_PATH");
  assertStoragePath(backupDir, "BACKUP_DIR");
  assertStoragePath(uploadsDir, "Uploads directory");
  mkdirSync(dirname(databasePath), { recursive: true });
  mkdirSync(backupDir, { recursive: true });
  mkdirSync(uploadsDir, { recursive: true });

  if (process.getuid?.() === 0) {
    repairOwnership(dataDir);
    for (const target of [dirname(databasePath), backupDir]) {
      let parent = target;
      while (parent !== dataDir) {
        repairOwnership(parent);
        parent = dirname(parent);
      }
    }
    repairOwnership(uploadsDir, true);
    repairOwnership(backupDir, true);
    for (const path of [databasePath, `${databasePath}-wal`, `${databasePath}-shm`, `${databasePath}-journal`]) {
      assertStoragePath(path, "SQLite file");
      repairOwnership(path);
    }
    process.setgroups([]);
    process.setgid(runtimeGid);
    process.setuid(runtimeUid);
  }

  for (const directory of new Set([dataDir, dirname(databasePath), backupDir, uploadsDir])) verifyWritable(directory);
  if (existsSync(databasePath)) accessSync(databasePath, constants.R_OK | constants.W_OK);
  console.log(JSON.stringify({ event: "storage.ready", uid: process.getuid?.(), gid: process.getgid?.(), dataDir, backupDir }));

  const [command, ...args] = process.argv.slice(2);
  if (!command) throw new Error("The Docker entrypoint requires a server command.");
  const child = spawn(command, args, { stdio: "inherit", env: process.env });
  for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => child.kill(signal));
  child.on("error", (error) => {
    console.error(JSON.stringify({ event: "server.start_failed", message: error.message }));
    process.exitCode = 1;
  });
  child.on("exit", (code, signal) => process.exit(signal ? 0 : code ?? 1));
} catch (error) {
  console.error(JSON.stringify({ event: "storage.initialization_failed", message: error instanceof Error ? error.message : String(error), code: error?.cause?.code || error?.code }));
  process.exitCode = 1;
}
