import { getRawDb } from "@/db/raw";
import { normalizeCourseDesign, type CourseMaterialRecord } from "@/lib/course-design";

const parse = <T,>(value: string, fallback: T) => { try { return JSON.parse(value || "") as T; } catch { return fallback; } };

export async function GET() {
  const rows = await getRawDb().prepare(`SELECT c.id, c.code, c.title, c.discipline, c.description, c.design_json, c.materials_json, c.activities_json, c.certificate_enabled, c.activated_at, u.full_name AS facilitator_name
    FROM course_drafts c LEFT JOIN users u ON u.email = c.created_by_email
    WHERE c.status = 'active' ORDER BY c.activated_at DESC, c.created_at DESC LIMIT 100`).all<{ id:number; code:string; title:string; discipline:string; description:string; design_json:string; materials_json:string; activities_json:string; certificate_enabled:number; activated_at:string|null; facilitator_name:string|null }>();
  return Response.json({ courses: rows.results.map((row) => ({
    id: row.id, code: row.code, title: row.title, discipline: row.discipline, description: row.description,
    design: normalizeCourseDesign(parse(row.design_json, {})), materials: parse<CourseMaterialRecord[]>(row.materials_json, []),
    activities: parse<unknown[]>(row.activities_json, []), certificateEnabled: Boolean(row.certificate_enabled), activatedAt: row.activated_at,
    facilitatorName: row.facilitator_name || "University of Cape Coast"
  })) });
}
