import { requireActiveProfile } from "@/lib/accounts";
import { getStoredFile, putStoredFile } from "@/lib/render-storage";

export async function GET(request: Request) {
  const account = await requireActiveProfile(["facilitator", "admin"]);
  if (account.error || !account.profile) return account.error;

  const key = new URL(request.url).searchParams.get("key")?.trim();
  if (!key) return Response.json({ error: "A stored-file key is required." }, { status: 400 });

  try {
    const stored = await getStoredFile(key);
    const ownsFile = stored.metadata.ownerEmail?.toLowerCase() === account.profile.email.toLowerCase();
    if (stored.metadata.evidenceKind !== "course-material" || (account.profile.role !== "admin" && !ownsFile)) {
      return Response.json({ error: "The file was not found or access is not permitted." }, { status: 404 });
    }

    const safeName = (stored.metadata.originalName || "ucc-course-file").replace(/["\r\n]/g, "-");
    return new Response(stored.body, {
      headers: {
        "content-type": stored.metadata.contentType || "application/octet-stream",
        "content-disposition": `attachment; filename="${safeName}"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return Response.json({ error: "The file was not found or access is not permitted." }, { status: 404 });
  }
}

export async function POST(request: Request) {
  const account = await requireActiveProfile(["facilitator", "admin"]);
  if (account.error || !account.profile) return account.error;
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "A file is required." }, { status: 400 });
  }
  if (file.size > 50 * 1024 * 1024) {
    return Response.json({ error: "Files must be 50 MB or smaller." }, { status: 413 });
  }

  const key = await putStoredFile("course-materials", file, { contentType: file.type || "application/octet-stream", originalName: file.name, ownerEmail: account.profile.email, evidenceKind: "course-material" });

  return Response.json({
    key,
    name: file.name,
    size: file.size,
    type: file.type || "application/octet-stream",
  });
}
