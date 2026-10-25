import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { PYTHON_LAB_VERSION } from "@/lib/python-lab-runtime";
type Manifest = { version: string; files: Record<string, { sha256: string; bytes: number }> };
let manifest: Promise<Manifest> | undefined;
const root = () => join(process.cwd(), "public", "vendor", "pyodide");
export async function GET(_request: Request, { params }: { params: Promise<{ version: string; file: string }> }) {
  const { version, file } = await params;
  if (version !== PYTHON_LAB_VERSION || !/^[a-zA-Z0-9_.-]+$/.test(file) || file.includes("..")) return new Response("Runtime file unavailable.", { status: 404 });
  try {
    manifest ??= readFile(join(root(), "manifest.json"), "utf8").then(text => JSON.parse(text) as Manifest);
    const files = (await manifest).files;
    const entry = Object.hasOwn(files, file) ? files[file] : undefined;
    if (!entry) return new Response("Runtime file unavailable.", { status: 404 });
    const body = await readFile(join(root(), file));
    if (body.byteLength !== entry.bytes || createHash("sha256").update(body).digest("hex") !== entry.sha256) throw new Error("Runtime integrity check failed.");
    const type = file.endsWith(".wasm") ? "application/wasm" : /\.m?js$/.test(file) ? "text/javascript; charset=utf-8" : file.endsWith(".json") ? "application/json" : "application/octet-stream";
    return new Response(new Uint8Array(body), { headers: { "content-type": type, "cache-control": "public, max-age=31536000, immutable", "access-control-allow-origin": "*", "cross-origin-resource-policy": "cross-origin", "x-content-type-options": "nosniff" } });
  } catch { return new Response("Python runtime files are incomplete. Restore the complete release assets.", { status: 503 }); }
}
