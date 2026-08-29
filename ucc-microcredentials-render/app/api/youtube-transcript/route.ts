import { requireActiveProfile } from "@/lib/accounts";

const videoIdFromUrl = (value: string) => value.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/)?.[1] ?? "";
const decodeXml = (value: string) => value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const timestamp = (seconds: number) => { const value = Math.max(0, Math.floor(seconds)); const hours = Math.floor(value / 3600); const minutes = Math.floor((value % 3600) / 60); const remaining = value % 60; return hours ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}` : `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`; };

type CaptionTrack = { languageCode: string; name: string; kind: string };

function parseTrackList(xml: string): CaptionTrack[] {
  return [...xml.matchAll(/<track\b([^>]*)\/?\s*>/g)].map((match) => {
    const attributes = Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map((item) => [item[1], decodeXml(item[2])]));
    return { languageCode: attributes.lang_code ?? "", name: attributes.name ?? "", kind: attributes.kind ?? "" };
  }).filter((track) => track.languageCode);
}

async function captionText(videoId: string, track: CaptionTrack) {
  const captionUrl = new URL("https://www.youtube.com/api/timedtext");
  captionUrl.searchParams.set("v", videoId); captionUrl.searchParams.set("lang", track.languageCode); captionUrl.searchParams.set("fmt", "json3");
  if (track.name) captionUrl.searchParams.set("name", track.name); if (track.kind) captionUrl.searchParams.set("kind", track.kind);
  const response = await fetch(captionUrl, { headers: { "user-agent": "UCC-Microcredentials/1.0 (accessible-learning-transcript)" } });
  if (!response.ok) return "";
  const data = await response.json() as { events?: Array<{ tStartMs?: number; segs?: Array<{ utf8?: string }> }> };
  return (data.events ?? []).map((event) => { const text = (event.segs ?? []).map((segment) => segment.utf8 ?? "").join("").replace(/\s+/g, " ").trim(); return text ? `${timestamp((event.tStartMs ?? 0) / 1000)} — ${text}` : ""; }).filter(Boolean).join("\n");
}

export async function POST(request: Request) {
  const account = await requireActiveProfile(["facilitator", "admin"]);
  if (account.error) return account.error;
  const payload = await request.json() as { youtubeUrl?: string; language?: string };
  const videoId = videoIdFromUrl(payload.youtubeUrl?.trim() ?? "");
  if (!videoId) return Response.json({ error: "Enter a valid YouTube video URL." }, { status: 400 });
  try {
    const listResponse = await fetch(`https://www.youtube.com/api/timedtext?type=list&v=${encodeURIComponent(videoId)}`, { headers: { "user-agent": "UCC-Microcredentials/1.0 (accessible-learning-transcript)" } });
    if (!listResponse.ok) throw new Error("Caption service unavailable");
    const tracks = parseTrackList(await listResponse.text());
    if (!tracks.length) return Response.json({ error: "No public caption track is available for this video. Paste or upload a creator-supplied transcript instead." }, { status: 404 });
    const requested = payload.language?.toLowerCase() ?? "english";
    const preferredCode = requested === "french" ? "fr" : requested === "akan" ? "ak" : "en";
    const track = tracks.find((item) => item.languageCode.toLowerCase().startsWith(preferredCode)) ?? tracks[0];
    const transcript = await captionText(videoId, track);
    if (!transcript) return Response.json({ error: "The caption track was found but could not be extracted. Paste or upload the transcript for review." }, { status: 422 });
    return Response.json({ transcript, languageCode: track.languageCode, source: track.kind === "asr" ? "YouTube automatic captions" : "YouTube creator captions", trackCount: tracks.length });
  } catch { return Response.json({ error: "The transcript could not be extracted from YouTube. Paste or upload a caption file instead." }, { status: 502 }); }
}
