import { createReadStream, existsSync, statSync } from "node:fs";
import { basename, join, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { getRawDb } from "@/db/raw";
import { requireActiveProfile } from "@/lib/accounts";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const account = await requireActiveProfile(["admin"]);
  if (account.error || !account.profile) return account.error;
  const requested = new URL(request.url).searchParams.get("file")?.trim();
  if (!requested) {
    const rows = await getRawDb().prepare("SELECT backup_file,checksum,database_integrity,upload_files,size_bytes,status,created_at FROM backup_runs ORDER BY id DESC LIMIT 30").all();
    return Response.json({ backups: rows.results }, { headers: { "cache-control": "no-store" } });
  }
  const safeName = basename(requested);
  if (safeName !== requested || !/^ucc-growthplus-[A-Za-z0-9-]+\.tar\.gz$/.test(safeName)) return Response.json({ error: "Invalid backup file." }, { status: 400 });
  const dataDir = resolve(process.env.DATA_DIR || join(process.cwd(), ".data"));
  const backupDir = resolve(process.env.BACKUP_DIR || join(dataDir, "backups"));
  const path = resolve(backupDir, safeName);
  if (!path.startsWith(`${backupDir}${sep}`) || !existsSync(path)) return Response.json({ error: "Backup not found." }, { status: 404 });
  await recordAudit(account.profile.email, "backup.downloaded", { file: safeName });
  const stream = Readable.toWeb(createReadStream(path)) as ReadableStream;
  return new Response(stream, { headers: { "content-type": "application/gzip", "content-length": String(statSync(path).size), "content-disposition": `attachment; filename="${safeName}"`, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
}
