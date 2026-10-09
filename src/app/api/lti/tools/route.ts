import { requireActiveProfile } from "@/lib/accounts";
import { getRawDb } from "@/db/raw";
import { recordAudit } from "@/lib/audit";
import { rejectCrossSiteMutation } from "@/lib/request-security";
import { ensureLtiTables, getLtiTool, ltiErrorResponse, LtiError, ltiMetadata, platformJwks, toolJwks, validateToolTarget, type LtiTool } from "@/lib/lti-platform";
const https = (raw: unknown) => { const url = new URL(String(raw || "")); if (url.protocol !== "https:" || url.username || url.password || url.hash) throw new LtiError("Tool endpoints must be HTTPS URLs without credentials or fragments."); return url.toString(); };
export async function GET() {
  const account = await requireActiveProfile(["facilitator", "admin"]); if (account.error || !account.profile) return account.error;
  ensureLtiTables(); const admin = account.profile.role === "admin";
  const rows = await getRawDb().prepare(`SELECT t.*,(SELECT MAX(created_at) FROM lti_score_events WHERE tool_id=t.id) last_grade_at FROM lti_tools t ${admin ? "" : "WHERE enabled=1"} ORDER BY created_at DESC`).all<LtiTool & { verified_at: string; verification_error: string; last_grade_at: string }>();
  let platform: ReturnType<typeof ltiMetadata> | undefined, configurationError = "";
  try { platform = ltiMetadata(); if (admin) await platformJwks(); } catch (e) { configurationError = e instanceof Error ? e.message : "Platform configuration unavailable."; }
  return Response.json({ admin, platform: admin ? platform : undefined, configurationError, tools: rows.results.map(t => admin ? { ...t, jwks_json: t.jwks_json ? JSON.parse(t.jwks_json) : null } : { id: t.id, name: t.name, deepLinkAvailable: Boolean(t.deep_link_url), defaultLaunchUrl: JSON.parse(t.redirect_uris_json)[0] }) });
}
export async function POST(request: Request) {
  const origin = rejectCrossSiteMutation(request); if (origin) return origin;
  const account = await requireActiveProfile(["admin"]); if (account.error || !account.profile) return account.error;
  try {
    ensureLtiTables(); const body = await request.json() as Record<string, unknown>;
    if (body.action === "verify") { const tool = await getLtiTool(String(body.id), false); try { await toolJwks(tool); await getRawDb().prepare("UPDATE lti_tools SET verified_at=CURRENT_TIMESTAMP,verification_error=NULL WHERE id=?").bind(tool.id).run(); return Response.json({ verified: true, message: "The public signing keys are valid. Complete a learner launch and grade return to verify the full connection." }); } catch (e) { await getRawDb().prepare("UPDATE lti_tools SET verification_error=? WHERE id=?").bind(e instanceof Error ? e.message : "Key verification failed", tool.id).run(); throw e; } }
    if (body.action === "toggle") { const tool = await getLtiTool(String(body.id), false); await getRawDb().prepare("UPDATE lti_tools SET enabled=? WHERE id=?").bind(body.enabled === true ? 1 : 0, tool.id).run(); await recordAudit(account.profile.email, "lti.tool_enabled_changed", { id: tool.id, enabled: body.enabled === true }); return Response.json({ ok: true }); }
    ltiMetadata();
    const existing = body.id ? await getLtiTool(String(body.id), false) : null;
    const id = existing?.id || crypto.randomUUID(); const name = String(body.name || "").trim().slice(0, 240); if (!name) throw new LtiError("Provide a tool name.");
    const loginUrl = https(body.loginUrl), redirects = Array.isArray(body.redirectUris) ? body.redirectUris.map(https).slice(0, 20) : [];
    if (!redirects.length) throw new LtiError("Register at least one exact redirect URI.");
    const origins = Array.isArray(body.allowedOrigins) ? [...new Set(body.allowedOrigins.map(v => new URL(https(v)).origin))].slice(0, 20) : [];
    if (!origins.length) throw new LtiError("Specify the allowed content origins.");
    const jwksUrl = body.jwksUrl ? https(body.jwksUrl) : "", jwksJson = body.jwks ? JSON.stringify(body.jwks) : "";
    if (!jwksUrl && !jwksJson) throw new LtiError("Provide the tool's public key-set URL or its public RSA key set.");
    const deepLinkUrl = body.deepLinkUrl ? https(body.deepLinkUrl) : "";
    const tool: LtiTool = { id, name, client_id: existing?.client_id || crypto.randomUUID(), deployment_id: existing?.deployment_id || crypto.randomUUID(), login_url: loginUrl, redirect_uris_json: JSON.stringify(redirects), jwks_url: jwksUrl, jwks_json: jwksJson, origins_json: JSON.stringify(origins), deep_link_url: deepLinkUrl, enabled: existing?.enabled ?? 1, share_name: body.shareName === true ? 1 : 0, share_email: body.shareEmail === true ? 1 : 0 };
    for (const url of [loginUrl, ...redirects, deepLinkUrl].filter(Boolean)) validateToolTarget(tool, url);
    if (jwksJson) await toolJwks(tool);
    if (existing) await getRawDb().prepare("UPDATE lti_tools SET name=?,login_url=?,redirect_uris_json=?,jwks_url=?,jwks_json=?,origins_json=?,deep_link_url=?,share_name=?,share_email=?,verified_at=NULL,verification_error=NULL WHERE id=?").bind(name, loginUrl, tool.redirect_uris_json, jwksUrl, jwksJson, tool.origins_json, deepLinkUrl, tool.share_name, tool.share_email, id).run();
    else await getRawDb().prepare("INSERT INTO lti_tools(id,name,client_id,deployment_id,login_url,redirect_uris_json,jwks_url,jwks_json,origins_json,deep_link_url,share_name,share_email,created_by_email) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id, name, tool.client_id, tool.deployment_id, loginUrl, tool.redirect_uris_json, jwksUrl, jwksJson, tool.origins_json, deepLinkUrl, tool.share_name, tool.share_email, account.profile.email).run();
    await recordAudit(account.profile.email, "lti.tool_registered", { id, name }); return Response.json({ id, clientId: tool.client_id, deploymentId: tool.deployment_id, platform: ltiMetadata() }, { status: existing ? 200 : 201 });
  } catch (e) { return ltiErrorResponse(e); }
}
