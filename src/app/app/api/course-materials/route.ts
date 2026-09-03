import { getRawDb } from "@/db/raw";
import { requireActiveProfile } from "@/lib/accounts";
import { getStoredFile } from "@/lib/render-storage";

type CandidateCourse = { created_by_email: string; status: string; materials_json: string; enrolled?: number };

function containsFileKey(materialsJson: string, key: string) {
  try {
    const materials = JSON.parse(materialsJson || "[]") as unknown;
    return Array.isArray(materials) && materials.some((item) => item && typeof item === "object" && (item as { fileKey?: unknown }).fileKey === key);
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const account = await requireActiveProfile();
  if (account.error || !account.profile) return account.error;
  const key = new URL(request.url).searchParams.get("key")?.trim() ?? "";
  if (!/^course-materials\/[a-zA-Z0-9/_\-.]+$/.test(key)) return Response.json({ error: "A valid course material is required." }, { status: 400 });

  try {
    const stored = await getStoredFile(key);
    if (stored.metadata.evidenceKind && stored.metadata.evidenceKind !== "course-material") return Response.json({ error: "This file is not a course material." }, { status: 403 });
    let authorised = account.profile.role === "admin";
    if (!authorised && account.profile.role === "facilitator" && stored.metadata.ownerEmail === account.profile.email) authorised = true;

    if (!authorised) {
      const db = getRawDb();
      const needle = `%${key.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
      if (account.profile.role === "learner") {
        const candidates = await db.prepare(`
          SELECT c.created_by_email, c.status, c.materials_json, 1 AS enrolled
          FROM course_drafts c JOIN enrollments e ON e.course_code = c.code
          WHERE c.status = 'active' AND e.user_email = ? AND e.status IN ('active','completed')
            AND c.materials_json LIKE ? ESCAPE '\\'
        `).bind(account.profile.email, needle).all<CandidateCourse>();
        authorised = candidates.results.some((course) => containsFileKey(course.materials_json, key) && (!stored.metadata.ownerEmail || stored.metadata.ownerEmail === course.created_by_email));
      } else {
        const candidates = await db.prepare("SELECT created_by_email, status, materials_json FROM course_drafts WHERE created_by_email = ? AND materials_json LIKE ? ESCAPE '\\'")
          .bind(account.profile.email, needle).all<CandidateCourse>();
        authorised = candidates.results.some((course) => containsFileKey(course.materials_json, key));
      }
    }
    if (!authorised) return Response.json({ error: "This material is not available in your course access." }, { status: 403 });

    const contentType = stored.metadata.contentType || "application/octet-stream";
    const safeName = (stored.metadata.originalName || "course-material").replace(/["\r\n]/g, "-");
    const inline = contentType === "application/pdf" || /^(image|audio|video|text)\//.test(contentType);
    return new Response(stored.body, {
      headers: {
        "content-type": contentType,
        "content-length": String(stored.body.length),
        "cache-control": "private, no-store",
        "content-disposition": `${inline ? "inline" : "attachment"}; filename="${safeName}"`,
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return Response.json({ error: "Course material was not found." }, { status: 404 });
  }
}
