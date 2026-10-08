import { spawn } from "node:child_process";
import { join } from "node:path";
import { createHmac } from "node:crypto";

const child = spawn(process.execPath, ["server.js"], { stdio: "inherit", env: process.env });
const enabled = process.env.AUTO_BACKUP_ENABLED?.trim().toLowerCase() === "true";
const intervalHours = Math.min(168, Math.max(1, Number(process.env.BACKUP_INTERVAL_HOURS || 24)));
let running = false;
let deliveryRunning = false;
const runDelivery = async () => {
  if (deliveryRunning || !process.env.AUTH_SECRET) return;
  deliveryRunning = true;
  try {
    const token = createHmac("sha256", process.env.AUTH_SECRET).update("ucc-delivery-worker-v1").digest("hex");
    const response = await fetch(`http://127.0.0.1:${process.env.PORT || 10000}/api/internal/delivery`, { method:"POST", headers:{authorization:`Bearer ${token}`}, signal:AbortSignal.timeout(180000) });
    if (!response.ok) console.error(JSON.stringify({event:"delivery.maintenance_failed",status:response.status}));
  } catch { console.error(JSON.stringify({event:"delivery.maintenance_unavailable"})); }
  finally { deliveryRunning = false; }
};
setTimeout(runDelivery, 15000).unref();
setInterval(runDelivery, 60000).unref();

const runMaintenance = () => {
  if (!enabled || running) return;
  running = true;
  const backup = spawn(process.execPath, [join("scripts", "pilot-backup.mjs")], { stdio: "inherit", env: process.env });
  backup.on("error", (error) => {
    console.error(JSON.stringify({ event: "maintenance.backup_start_failed", message: error.message }));
  });
  backup.on("close", (code) => {
    if (code !== 0) {
      console.error(JSON.stringify({ event: "maintenance.retention_skipped", reason: "The backup failed.", backupExitCode: code }));
      running = false;
      return;
    }
    const retention = spawn(process.execPath, [join("scripts", "enforce-identity-retention.mjs")], { stdio: "inherit", env: process.env });
    retention.on("error", (error) => {
      console.error(JSON.stringify({ event: "maintenance.retention_start_failed", message: error.message }));
    });
    retention.on("close", () => { running = false; });
  });
};

if (enabled) {
  setTimeout(runMaintenance, 60_000).unref();
  setInterval(runMaintenance, intervalHours * 60 * 60 * 1000).unref();
}
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code, signal) => process.exit(signal ? 0 : code ?? 1));
child.on("error", (error) => {
  console.error(JSON.stringify({ event: "server.start_failed", message: error.message }));
  process.exit(1);
});
