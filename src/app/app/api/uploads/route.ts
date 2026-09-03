import { requireActiveProfile } from "@/lib/accounts";
import { putStoredFile } from "@/lib/render-storage";

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
