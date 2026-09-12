export function rejectCrossSiteMutation(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return Response.json({ error: "Cross-site requests are not permitted." }, { status: 403 });
  const origin = request.headers.get("origin");
  if (!origin) return null;
  try {
    if (new URL(origin).origin !== new URL(request.url).origin) return Response.json({ error: "Request origin is not permitted." }, { status: 403 });
  } catch { return Response.json({ error: "Invalid request origin." }, { status: 403 }); }
  return null;
}
