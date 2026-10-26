import { ProgrammeError, programmeFailure } from "./programmes";

export async function programmePayload(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new ProgrammeError("Send a JSON programme request.", 415);
  const reader = request.body?.getReader(); if (!reader) throw new ProgrammeError("A request body is required.");
  const chunks: Uint8Array[] = []; let bytes = 0;
  try { while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.byteLength; if (bytes > 512_000) { await reader.cancel(); throw new ProgrammeError("The programme request exceeds 512 KB.", 413); } chunks.push(part.value); } } finally { reader.releaseLock(); }
  let value: unknown; try { value = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new ProgrammeError("The programme request contains invalid JSON."); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ProgrammeError("Provide a programme request object.");
  return value as Record<string, unknown>;
}
export function programmeResponse(value: unknown, status = 200) { return Response.json(value, { status, headers: { "cache-control": "private, no-store" } }); }
export function programmeHttpFailure(error: unknown) { return programmeFailure(error instanceof Error && !(error instanceof ProgrammeError) && error.message.startsWith("Use at most") ? new ProgrammeError(error.message) : error); }
