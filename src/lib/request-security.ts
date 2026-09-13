const firstHeaderValue = (value: string | null) => value?.split(",", 1)[0]?.trim() || "";

function normalizedOrigin(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.origin : "";
  } catch {
    return "";
  }
}

function permittedOrigins(request: Request) {
  const origins = new Set<string>();
  const requestUrl = new URL(request.url);
  origins.add(requestUrl.origin);

  // Render terminates HTTPS at its proxy. Next.js can therefore receive an
  // internal HTTP URL even though the browser correctly sends the public HTTPS
  // Origin. Reconstruct the public origin from the proxy headers Render sets.
  const forwardedProtocol = firstHeaderValue(request.headers.get("x-forwarded-proto"));
  const protocol = forwardedProtocol === "https" || forwardedProtocol === "http"
    ? `${forwardedProtocol}:`
    : requestUrl.protocol;
  const hosts = [
    firstHeaderValue(request.headers.get("x-forwarded-host")),
    firstHeaderValue(request.headers.get("host")),
  ].filter(Boolean);
  for (const host of hosts) {
    const candidate = normalizedOrigin(`${protocol}//${host}`);
    if (candidate) origins.add(candidate);
  }

  for (const configured of [
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.RENDER_EXTERNAL_URL,
    process.env.AUTH_URL,
  ]) {
    const candidate = normalizedOrigin(configured?.trim() || "");
    if (candidate) origins.add(candidate);
  }
  return origins;
}

export function rejectCrossSiteMutation(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite === "cross-site") {
    return Response.json({ error: "Cross-site requests are not permitted." }, { status: 403 });
  }

  // Sec-Fetch-Site is a browser-controlled forbidden header. When it says the
  // fetch is same-origin, it is more authoritative than an internal proxy URL.
  if (fetchSite === "same-origin") return null;

  const suppliedOrigin = request.headers.get("origin");
  if (!suppliedOrigin) return null;
  const origin = normalizedOrigin(suppliedOrigin);
  if (!origin) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  if (!permittedOrigins(request).has(origin)) {
    return Response.json({ error: "Request origin is not permitted." }, { status: 403 });
  }
  return null;
}
