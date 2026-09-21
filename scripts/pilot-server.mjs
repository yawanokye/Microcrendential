import { spawn } from "node:child_process";
import { join } from "node:path";

const child = spawn(process.execPath, ["server.js"], { stdio: "inherit", env: process.env });
const enabled = process.env.AUTO_BACKUP_ENABLED?.trim().toLowerCase() === "true";
const intervalHours = Math.min(168, Math.max(1, Number(process.env.BACKUP_INTERVAL_HOURS || 24)));
let running = false;

const runMaintenance = () => {
  if (!enabled || running) return;
  running = true;
  const backup = spawn(process.execPath, [join("scripts", "pilot-backup.mjs")], { stdio: "inherit", env: process.env });
  backup.on("exit", () => {
    const retention = spawn(process.execPath, [join("scripts", "enforce-identity-retention.mjs")], { stdio: "inherit", env: process.env });
    retention.on("exit", () => { running = false; });
  });
};

if (enabled) {
  setTimeout(runMaintenance, 60_000).unref();
  setInterval(runMaintenance, intervalHours * 60 * 60 * 1000).unref();
}
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code, signal) => process.exit(signal ? 0 : code ?? 1));
