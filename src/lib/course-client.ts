/** Load bounded catalogue pages without dropping older courses from portal lists. */
export async function fetchCourseCatalogue(): Promise<Response> {
  const courses: unknown[] = [];
  let offset = 0;
  for (;;) {
    const response = await fetch(`/api/courses?offset=${offset}`, { cache: "no-store" });
    if (!response.ok) return response;
    const page = await response.json() as { courses?: unknown[]; nextOffset?: number | null };
    courses.push(...(page.courses || []));
    if (page.nextOffset == null) return Response.json({ courses });
    if (page.nextOffset <= offset) throw new Error("Course catalogue pagination did not advance.");
    offset = page.nextOffset;
  }
}
