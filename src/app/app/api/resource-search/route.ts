import { requireActiveProfile } from "@/lib/accounts";

type LearningResource = {
  type: "Watch" | "Read" | "Code";
  title: string;
  source: string;
  license: string;
  url: string;
  externalUrl: string;
};

const cleanUrl = (value: string | null | undefined) => value?.replace(/^http:\/\//, "https://") ?? "";

export async function GET(request: Request) {
  const account = await requireActiveProfile(["facilitator", "admin"]);
  if (account.error) return account.error;
  const url = new URL(request.url);
  const youtubeUrl = url.searchParams.get("youtubeUrl")?.trim();

  if (youtubeUrl) {
    const match = youtubeUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/);
    if (!match) return Response.json({ error: "Enter a valid YouTube video URL." }, { status: 400 });
    let title = "YouTube learning video";
    let source = "YouTube";
    try {
      const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${match[1]}`)}&format=json`);
      if (response.ok) {
        const metadata = await response.json() as { title?: string; author_name?: string };
        title = metadata.title ?? title;
        source = metadata.author_name ? `${metadata.author_name} · YouTube` : source;
      }
    } catch { /* The embed remains usable even when metadata lookup is unavailable. */ }
    return Response.json({ resource: { type: "Watch", title, source, license: "YouTube terms", url: `https://www.youtube-nocookie.com/embed/${match[1]}`, externalUrl: `https://www.youtube.com/watch?v=${match[1]}` } satisfies LearningResource });
  }

  const query = url.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return Response.json({ error: "Enter at least two search characters." }, { status: 400 });

  const resources: LearningResource[] = [];
  const errors: string[] = [];

  try {
    const openAlexUrl = new URL("https://api.openalex.org/works");
    openAlexUrl.searchParams.set("search", query);
    openAlexUrl.searchParams.set("filter", "has_fulltext:true,is_paratext:false");
    openAlexUrl.searchParams.set("per-page", "6");
    openAlexUrl.searchParams.set("select", "title,primary_location,open_access,authorships,publication_year");
    const response = await fetch(openAlexUrl, { headers: { "user-agent": "UCC-Microcredentials/1.0 (learning-resource-search)" } });
    if (response.ok) {
      const data = await response.json() as { results?: Array<{ title?: string; publication_year?: number; open_access?: { oa_url?: string; oa_status?: string }; primary_location?: { landing_page_url?: string; source?: { display_name?: string } }; authorships?: Array<{ author?: { display_name?: string } }> }> };
      for (const work of data.results ?? []) {
        const target = cleanUrl(work.open_access?.oa_url) || cleanUrl(work.primary_location?.landing_page_url);
        if (!work.title || !target) continue;
        const publisher = work.primary_location?.source?.display_name ?? "Open-access research";
        const year = work.publication_year ? ` · ${work.publication_year}` : "";
        resources.push({ type: "Read", title: work.title, source: `${publisher}${year}`, license: work.open_access?.oa_status ? `Open access · ${work.open_access.oa_status}` : "Open access", url: target, externalUrl: target });
      }
    } else errors.push("OpenAlex search unavailable");
  } catch { errors.push("OpenAlex search unavailable"); }

  try {
    const archiveUrl = new URL("https://archive.org/advancedsearch.php");
    archiveUrl.searchParams.set("q", `(title:(${query}) OR description:(${query})) AND (mediatype:movies OR mediatype:texts)`);
    archiveUrl.searchParams.append("fl[]", "identifier");
    archiveUrl.searchParams.append("fl[]", "title");
    archiveUrl.searchParams.append("fl[]", "mediatype");
    archiveUrl.searchParams.append("fl[]", "creator");
    archiveUrl.searchParams.append("fl[]", "licenseurl");
    archiveUrl.searchParams.set("rows", "6");
    archiveUrl.searchParams.set("output", "json");
    const response = await fetch(archiveUrl);
    if (response.ok) {
      const data = await response.json() as { response?: { docs?: Array<{ identifier?: string; title?: string; mediatype?: string; creator?: string | string[]; licenseurl?: string }> } };
      for (const item of data.response?.docs ?? []) {
        if (!item.identifier || !item.title) continue;
        const creator = Array.isArray(item.creator) ? item.creator.join(", ") : item.creator;
        resources.push({ type: item.mediatype === "movies" ? "Watch" : "Read", title: item.title, source: `${creator || "Open collection"} · Internet Archive`, license: item.licenseurl ? "Open licence supplied" : "Rights review required", url: `https://archive.org/embed/${encodeURIComponent(item.identifier)}`, externalUrl: `https://archive.org/details/${encodeURIComponent(item.identifier)}` });
      }
    } else errors.push("Internet Archive search unavailable");
  } catch { errors.push("Internet Archive search unavailable"); }

  return Response.json({ resources, errors, youtubeSearchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}` });
}
