import { createHash, createCipheriv, createDecipheriv, randomBytes, generateKeyPairSync } from "node:crypto";
import { createLocalJWKSet, exportJWK, importPKCS8, jwtVerify, SignJWT, type JSONWebKeySet, type JWTPayload } from "jose";
import { getRawDb } from "@/db/raw";
import { coursePermission, learningAccess, enrolledCourse, parseRecord } from "./course-access";
import { reviewAffectedCredential } from "./grading-workflow";
import type { AccountProfile } from "./accounts";
import { ensureStructuredLearningActivities, type StructuredLearningActivity } from "./structured-learning-activities";
import type { CourseMaterialRecord } from "./course-design";
import { fetchPublicResource } from "./public-url";
import { externalActivityIssues, ltiAgsClaim, ltiClaim, ltiDlClaim, ltiScopes, normalizeExternalActivity } from "./lti-types";

export type LtiTool = { id: string; name: string; client_id: string; deployment_id: string; login_url: string; redirect_uris_json: string; jwks_url: string; jwks_json: string; origins_json: string; deep_link_url: string; enabled: number; share_name: number; share_email: number };
export class LtiError extends Error { constructor(message: string, public status = 400) { super(message); } }
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const random = () => randomBytes(32).toString("base64url");
const now = () => Math.floor(Date.now() / 1000);
export function ensureLtiTables() {
  getRawDb().exec(`CREATE TABLE IF NOT EXISTS lti_tools (
    id TEXT PRIMARY KEY,name TEXT NOT NULL,client_id TEXT NOT NULL UNIQUE,deployment_id TEXT NOT NULL,
    login_url TEXT NOT NULL,redirect_uris_json TEXT NOT NULL,jwks_url TEXT NOT NULL DEFAULT '',jwks_json TEXT NOT NULL DEFAULT '',
    origins_json TEXT NOT NULL,deep_link_url TEXT NOT NULL DEFAULT '',enabled INTEGER NOT NULL DEFAULT 1,
    share_name INTEGER NOT NULL DEFAULT 0,share_email INTEGER NOT NULL DEFAULT 0,created_by_email TEXT NOT NULL,
    verified_at TEXT,verification_error TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );CREATE TABLE IF NOT EXISTS lti_subjects(subject TEXT PRIMARY KEY,user_email TEXT NOT NULL UNIQUE);
  CREATE TABLE IF NOT EXISTS lti_launches (
    hint_hash TEXT PRIMARY KEY,tool_id TEXT NOT NULL,owner_email TEXT NOT NULL,course_code TEXT NOT NULL,course_title TEXT NOT NULL,
    activity_json TEXT NOT NULL,preview INTEGER NOT NULL,purpose TEXT NOT NULL,expires_at INTEGER NOT NULL,consumed_at INTEGER,
    selection_id TEXT
  );CREATE TABLE IF NOT EXISTS lti_content_selections(id TEXT PRIMARY KEY,owner_email TEXT NOT NULL,tool_id TEXT NOT NULL,
    data_hash TEXT NOT NULL UNIQUE,expires_at INTEGER NOT NULL,result_json TEXT,used_at INTEGER);
  CREATE TABLE IF NOT EXISTS lti_assertions(tool_id TEXT NOT NULL,jti TEXT NOT NULL,expires_at INTEGER NOT NULL,PRIMARY KEY(tool_id,jti));
  CREATE TABLE IF NOT EXISTS lti_access_tokens(token_hash TEXT PRIMARY KEY,tool_id TEXT NOT NULL,scopes_json TEXT NOT NULL,expires_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS lti_resource_users(tool_id TEXT NOT NULL,course_code TEXT NOT NULL,activity_id TEXT NOT NULL,
    subject TEXT NOT NULL,user_email TEXT NOT NULL,activity_json TEXT NOT NULL,last_score_timestamp TEXT,
    PRIMARY KEY(tool_id,course_code,activity_id,subject));
  CREATE TABLE IF NOT EXISTS lti_score_events(id INTEGER PRIMARY KEY AUTOINCREMENT,tool_id TEXT NOT NULL,course_code TEXT NOT NULL,
    activity_id TEXT NOT NULL,subject TEXT NOT NULL,payload_hash TEXT NOT NULL,timestamp TEXT NOT NULL,
    payload_json TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tool_id,course_code,activity_id,subject,payload_hash));`);
}
export function ltiIssuer() {
  const raw = process.env.LTI_PLATFORM_ISSUER || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_PUBLIC_URL;
  if (!raw) throw new LtiError("Set NEXT_PUBLIC_APP_URL to the deployed HTTPS platform URL before connecting a learning tool.", 503);
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new LtiError("The LTI platform issuer must be a stable HTTPS URL.", 503);
  return url.toString().replace(/\/$/, "");
}
export function ltiMetadata() {
  const issuer = ltiIssuer();
  return { issuer, authorizationEndpoint: `${issuer}/api/lti/authorize`, tokenEndpoint: `${issuer}/api/lti/token`, jwksUrl: `${issuer}/api/lti/jwks`, deepLinkReturnUrl: `${issuer}/api/lti/deep-link`, scopes: Object.values(ltiScopes) };
}
async function platformKey() {
  ensureLtiTables();
  let pem = process.env.LTI_PLATFORM_PRIVATE_KEY_BASE64 ? Buffer.from(process.env.LTI_PLATFORM_PRIVATE_KEY_BASE64, "base64").toString("utf8") : "";
  if (!pem) {
    const secret = process.env.AUTH_SECRET?.trim();
    if (!secret) throw new LtiError("AUTH_SECRET is required to protect the persistent LTI signing key.", 503);
    const encryptionKey = createHash("sha256").update(`ucc-lti-key:${secret}`).digest();
    const stored = getRawDb().transaction(db => {
      const row = db.prepare("SELECT setting_value FROM platform_settings WHERE setting_key='lti_signing_key'").get() as { setting_value: string } | undefined;
      if (row) return row.setting_value;
      const generated = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { format: "pem", type: "pkcs8" }, publicKeyEncoding: { format: "pem", type: "spki" } }).privateKey;
      const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
      const encrypted = Buffer.concat([cipher.update(generated, "utf8"), cipher.final()]);
      const value = JSON.stringify({ iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: encrypted.toString("base64") });
      db.prepare("INSERT INTO platform_settings(setting_key,setting_value,updated_by_email) VALUES('lti_signing_key',?,'system')").run(value);
      return value;
    });
    try { const input = JSON.parse(stored); const decipher = createDecipheriv("aes-256-gcm", encryptionKey, Buffer.from(input.iv, "base64")); decipher.setAuthTag(Buffer.from(input.tag, "base64")); pem = Buffer.concat([decipher.update(Buffer.from(input.data, "base64")), decipher.final()]).toString("utf8"); }
    catch { throw new LtiError("The saved LTI signing key could not be opened. Restore its original AUTH_SECRET or configure the original signing key.", 503); }
  }
  const key = await importPKCS8(pem, "RS256", { extractable: true });
  const exported = await exportJWK(key);
  if (Buffer.from(exported.n || "", "base64url").length < 256) throw new LtiError("LTI requires an RSA signing key of at least 2048 bits.", 503);
  const kid = hash(`${exported.n}:${exported.e}`).slice(0, 24);
  const publicKey = { kty: "RSA", n: exported.n, e: exported.e, kid, alg: "RS256", use: "sig" };
  return { key, kid, publicKey };
}
export async function platformJwks() { return { keys: [(await platformKey()).publicKey] }; }
export async function getLtiTool(id: string, enabled = true) {
  ensureLtiTables();
  const tool = await getRawDb().prepare(`SELECT * FROM lti_tools WHERE id=? ${enabled ? "AND enabled=1" : ""}`).bind(id).first<LtiTool>();
  if (!tool) throw new LtiError("The external learning tool is unavailable. Contact the course team.", 409);
  return tool;
}
export function validateToolTarget(tool: LtiTool, value: string) {
  const url = new URL(value);
  const origins = parseRecord<string[]>(tool.origins_json, []);
  if (url.protocol !== "https:" || url.username || url.password || url.hash || !origins.includes(url.origin)) throw new LtiError("This activity URL is outside the registered tool's allowed HTTPS origins.");
  return url.toString();
}
export async function toolJwks(tool: LtiTool): Promise<JSONWebKeySet> {
  let data: JSONWebKeySet;
  if (tool.jwks_json) data = JSON.parse(tool.jwks_json);
  else { if (!tool.jwks_url.startsWith("https://")) throw new LtiError("The tool needs a public HTTPS key-set URL."); const resource = await fetchPublicResource(tool.jwks_url, 128 * 1024); data = JSON.parse(resource.body.toString("utf8")); }
  if (!Array.isArray(data.keys) || !data.keys.length || data.keys.length > 20 || data.keys.some(k => k.kty !== "RSA" || Boolean(k.d) || !k.kid || !k.n || !k.e || Buffer.from(k.n, "base64url").length < 256 || (k.alg && k.alg !== "RS256"))) throw new LtiError("Use a public RSA key set with unique key identifiers and keys of at least 2048 bits.");
  if (new Set(data.keys.map(k => k.kid)).size !== data.keys.length) throw new LtiError("Tool key identifiers must be unique.");
  return data;
}
export async function verifyToolJwt(tool: LtiTool, token: string, audience: string | string[]) {
  if (token.length > 128 * 1024) throw new LtiError("The signed tool message is too large.");
  try {
    const { payload } = await jwtVerify(token, createLocalJWKSet(await toolJwks(tool)), { algorithms: ["RS256"], issuer: tool.client_id, audience, clockTolerance: 30, requiredClaims: ["iss", "aud", "iat", "exp"] });
    if (!Number.isFinite(payload.iat) || !Number.isFinite(payload.exp) || payload.iat! > now() + 30 || payload.exp! - payload.iat! > 600) throw new Error();
    return payload;
  } catch { throw new LtiError("The external tool signature, issuer, audience or expiry could not be verified.", 401); }
}
async function subjectFor(email: string) {
  const subject = crypto.randomUUID();
  await getRawDb().prepare("INSERT OR IGNORE INTO lti_subjects(subject,user_email) VALUES(?,?)").bind(subject, email).run();
  return (await getRawDb().prepare("SELECT subject FROM lti_subjects WHERE user_email=?").bind(email).first<{ subject: string }>())!.subject;
}
export async function initiateLtiLaunch(profile: AccountProfile, input: { courseCode: string; activityId?: string; previewActivity?: StructuredLearningActivity; toolId?: string; deepLink?: boolean }) {
  ensureLtiTables(); const metadata = ltiMetadata();
  let activity: StructuredLearningActivity, courseTitle = input.courseCode || "Course design preview"; const preview = profile.role !== "learner";
  if (input.deepLink) {
    if (!preview || (input.courseCode && await getRawDb().prepare("SELECT code FROM course_drafts WHERE code=?").bind(input.courseCode).first() && !await coursePermission(profile, input.courseCode, "teach"))) throw new LtiError("Only the teaching team can select external content.", 403);
    const tool = await getLtiTool(input.toolId || "");
    if (!tool.deep_link_url) throw new LtiError("This tool has no content-selection endpoint configured.", 409);
    activity = { id: "content-selection", kind: "inline", title: "Select external content", instructions: "Select an activity for facilitator review.", required: false, passMark: 60, attemptsAllowed: 3, lti: { toolId: tool.id, launchUrl: tool.deep_link_url, custom: {} } };
  } else if (profile.role === "learner") {
    const access = await learningAccess(profile, input.courseCode); if (!access.course) throw new LtiError("An active course enrolment and the required identity verification are needed.", 403);
    courseTitle = access.course.title;
    activity = ensureStructuredLearningActivities(parseRecord<CourseMaterialRecord[]>(access.course.materials_json, []), parseRecord(access.course.activities_json, [])).find(a => a.id === input.activityId)!;
    if (!activity?.lti || !activity.materialId) throw new LtiError("This external learning activity was not found.", 404);
  } else {
    if (!preview || !["admin", "facilitator"].includes(profile.role)) throw new LtiError("Teaching access is required.", 403);
    const course = await getRawDb().prepare("SELECT title,materials_json,activities_json FROM course_drafts WHERE code=?").bind(input.courseCode).first<{ title: string; materials_json: string; activities_json: string }>();
    if (course && !await coursePermission(profile, input.courseCode, "teach")) throw new LtiError("You are not assigned to teach this course.", 403);
    courseTitle = course?.title || courseTitle;
    activity = input.previewActivity || (course ? ensureStructuredLearningActivities(parseRecord(course.materials_json, []), parseRecord(course.activities_json, [])).find(a => a.id === input.activityId)! : undefined!);
    if (!activity?.lti) throw new LtiError("Provide an external activity to preview.");
  }
  const issues = externalActivityIssues(activity.lti); if (issues.length) throw new LtiError(issues.join(" "));
  if (!preview && activity.dueAt && Date.parse(activity.dueAt) < Date.now()) throw new LtiError("The external activity deadline has passed.", 409);
  const tool = await getLtiTool(activity.lti!.toolId); validateToolTarget(tool, activity.lti!.launchUrl);
  const hint = random(); let selectionId: string | null = null;
  if (input.deepLink) { selectionId = crypto.randomUUID(); await getRawDb().prepare("INSERT INTO lti_content_selections(id,owner_email,tool_id,data_hash,expires_at) VALUES(?,?,?,?,?)").bind(selectionId, profile.email, tool.id, hash(hint), now() + 1800).run(); }
  await getRawDb().prepare("INSERT INTO lti_launches(hint_hash,tool_id,owner_email,course_code,course_title,activity_json,preview,purpose,expires_at,selection_id) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(hash(hint), tool.id, profile.email, input.courseCode, courseTitle, JSON.stringify(activity), preview ? 1 : 0, input.deepLink ? "deep_link" : "resource", now() + 300, selectionId).run();
  const url = new URL(tool.login_url); url.searchParams.set("iss", metadata.issuer); url.searchParams.set("login_hint", hint); url.searchParams.set("lti_message_hint", hint); url.searchParams.set("target_link_uri", activity.lti!.launchUrl); url.searchParams.set("client_id", tool.client_id); url.searchParams.set("lti_deployment_id", tool.deployment_id);
  return { url: url.toString(), selectionId };
}
export async function authorizeLti(profile: AccountProfile, params: URLSearchParams) {
  ensureLtiTables(); const metadata = ltiMetadata();
  if (params.get("response_type") !== "id_token" || params.get("response_mode") !== "form_post" || params.get("scope") !== "openid" || params.get("prompt") !== "none") throw new LtiError("Use the LTI OpenID authentication parameters.");
  const nonce = params.get("nonce") || "", state = params.get("state") || "", hint = params.get("login_hint") || "";
  if (!nonce || nonce.length > 512 || !state || state.length > 2048 || !hint || (params.get("lti_message_hint") && params.get("lti_message_hint") !== hint)) throw new LtiError("The launch state or nonce is missing or invalid.");
  const row = await getRawDb().prepare("SELECT * FROM lti_launches WHERE hint_hash=? AND expires_at>? AND consumed_at IS NULL").bind(hash(hint), now()).first<{ tool_id: string; owner_email: string; course_code: string; course_title: string; activity_json: string; preview: number; purpose: string; selection_id: string | null }>();
  if (!row || row.owner_email !== profile.email) throw new LtiError("The launch is expired, used, or belongs to another signed-in account.", 401);
  const tool = await getLtiTool(row.tool_id); const redirect = params.get("redirect_uri") || "";
  if (params.get("client_id") !== tool.client_id || !parseRecord<string[]>(tool.redirect_uris_json, []).includes(redirect)) throw new LtiError("The client or redirect URI is not registered.", 401);
  if (!row.preview && !(await learningAccess(profile, row.course_code)).course) throw new LtiError("Course access is no longer available.", 403);
  if (row.preview && row.course_code && await getRawDb().prepare("SELECT code FROM course_drafts WHERE code=?").bind(row.course_code).first() && !await coursePermission(profile, row.course_code, "teach")) throw new LtiError("Teaching access is no longer available.", 403);
  const activity = JSON.parse(row.activity_json) as StructuredLearningActivity;
  const key = await platformKey(), subject = await subjectFor(profile.email);
  const claims: JWTPayload = { nonce, [ltiClaim + "message_type"]: row.purpose === "deep_link" ? "LtiDeepLinkingRequest" : "LtiResourceLinkRequest", [ltiClaim + "version"]: "1.3.0", [ltiClaim + "deployment_id"]: tool.deployment_id, [ltiClaim + "target_link_uri"]: activity.lti!.launchUrl,
    [ltiClaim + "roles"]: [`http://purl.imsglobal.org/vocab/lis/v2/membership#${row.preview ? "Instructor" : "Learner"}`],
    [ltiClaim + "context"]: { id: row.course_code || "course-authoring", label: row.course_code, title: row.course_title, type: ["http://purl.imsglobal.org/vocab/lis/v2/course#CourseOffering"] },
    [ltiClaim + "tool_platform"]: { guid: hash(metadata.issuer), name: "UCC Growth+", product_family_code: "ucc-growth-plus", version: "13.2.0" },
    [ltiClaim + "launch_presentation"]: { document_target: "window", return_url: `${metadata.issuer}/learn/${encodeURIComponent(row.course_code)}/${encodeURIComponent(activity.materialId || "")}` }, [ltiClaim + "custom"]: activity.lti!.custom };
  if (tool.share_name) claims.name = profile.full_name;
  if (tool.share_email) claims.email = profile.email;
  if (row.purpose === "deep_link") claims[ltiDlClaim + "deep_linking_settings"] = { deep_link_return_url: metadata.deepLinkReturnUrl, accept_types: ["ltiResourceLink"], accept_presentation_document_targets: ["window"], accept_multiple: false, auto_create: false, data: hint, title: "Select interactive content" };
  else {
    claims[ltiClaim + "resource_link"] = { id: `${row.course_code}:${activity.id}`, title: activity.title };
    if (!row.preview) claims[ltiAgsClaim + "endpoint"] = { scope: Object.values(ltiScopes), lineitems: `${metadata.issuer}/api/lti/ags/${encodeURIComponent(row.course_code)}/lineitems`, lineitem: `${metadata.issuer}/api/lti/ags/${encodeURIComponent(row.course_code)}/lineitems/${encodeURIComponent(activity.id)}` };
  }
  const idToken = await new SignJWT(claims).setProtectedHeader({ alg: "RS256", typ: "JWT", kid: key.kid }).setIssuer(metadata.issuer).setAudience(tool.client_id).setSubject(subject).setIssuedAt().setExpirationTime("5m").sign(key.key);
  const used = await getRawDb().prepare("UPDATE lti_launches SET consumed_at=? WHERE hint_hash=? AND consumed_at IS NULL AND expires_at>?").bind(now(), hash(hint), now()).run();
  if (!used.meta.changes) throw new LtiError("This launch was already used.", 409);
  if (!row.preview && row.purpose === "resource") await getRawDb().prepare("INSERT INTO lti_resource_users(tool_id,course_code,activity_id,subject,user_email,activity_json) VALUES(?,?,?,?,?,?) ON CONFLICT(tool_id,course_code,activity_id,subject) DO UPDATE SET activity_json=excluded.activity_json").bind(tool.id, row.course_code, activity.id, subject, profile.email, JSON.stringify(activity)).run();
  return { redirect, state, idToken };
}
export function ltiFormResponse(action: string, fields: Record<string, string>) {
  const escape = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  const nonce = randomBytes(18).toString("base64");
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Opening learning activity</title></head><body><p>Opening your learning activity…</p><form method="post" action="${escape(action)}">${Object.entries(fields).map(([k, v]) => `<input type="hidden" name="${escape(k)}" value="${escape(v)}">`).join("")}<button type="submit">Continue to activity</button></form><script nonce="${nonce}">document.forms[0].submit();</script></body></html>`, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer", "content-security-policy": `default-src 'none'; script-src 'nonce-${nonce}'; form-action ${new URL(action).origin}; base-uri 'none'; frame-ancestors 'self'` } });
}
export async function issueLtiToken(params: URLSearchParams) {
  ensureLtiTables();
  if (params.get("grant_type") !== "client_credentials" || params.get("client_assertion_type") !== "urn:ietf:params:oauth:client-assertion-type:jwt-bearer") throw new LtiError("Use a signed client-credentials assertion.", 400);
  const token = params.get("client_assertion") || ""; let client: string;
  try { client = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")).sub; } catch { throw new LtiError("Invalid client assertion.", 401); }
  const tool = await getRawDb().prepare("SELECT * FROM lti_tools WHERE client_id=? AND enabled=1").bind(String(client)).first<LtiTool>(); if (!tool) throw new LtiError("Unregistered client.", 401);
  const metadata = ltiMetadata(); const claims = await verifyToolJwt(tool, token, [metadata.tokenEndpoint, metadata.issuer]);
  if (claims.sub !== tool.client_id || !claims.jti || claims.jti.length > 200 || (claims[ltiClaim + "deployment_id"] && claims[ltiClaim + "deployment_id"] !== tool.deployment_id)) throw new LtiError("The client assertion is not valid for this deployment.", 401);
  const scopes = [...new Set((params.get("scope") || "").split(/\s+/).filter(Boolean))];
  if (!scopes.length || scopes.some(s => !Object.values(ltiScopes).includes(s))) throw new LtiError("The requested service scope is not supported.", 400);
  const access = random();
  getRawDb().transaction(db => {
    db.prepare("DELETE FROM lti_assertions WHERE expires_at<?").run(now() - 60);
    const inserted = db.prepare("INSERT OR IGNORE INTO lti_assertions(tool_id,jti,expires_at) VALUES(?,?,?)").run(tool.id, claims.jti!, claims.exp!);
    if (!inserted.changes) throw new LtiError("The client assertion was already used.", 401);
    db.prepare("INSERT INTO lti_access_tokens(token_hash,tool_id,scopes_json,expires_at) VALUES(?,?,?,?)").run(hash(access), tool.id, JSON.stringify(scopes), now() + 3600);
  });
  return { access_token: access, token_type: "Bearer", expires_in: 3600, scope: scopes.join(" ") };
}
export async function requireLtiService(request: Request, scope: string) {
  ensureLtiTables(); const token = request.headers.get("authorization")?.match(/^Bearer\s+([^\s]+)$/i)?.[1];
  const access = token ? await getRawDb().prepare("SELECT t.tool_id,t.scopes_json FROM lti_access_tokens t JOIN lti_tools l ON l.id=t.tool_id WHERE t.token_hash=? AND t.expires_at>? AND l.enabled=1").bind(hash(token), now()).first<{ tool_id: string; scopes_json: string }>() : null;
  if (!access) throw new LtiError("A current external-tool access token is required.", 401);
  if (!parseRecord<string[]>(access.scopes_json, []).includes(scope)) throw new LtiError("This token cannot access that grade service.", 403);
  return getLtiTool(access.tool_id);
}
export async function receiveDeepLink(token: string) {
  ensureLtiTables(); let client: string;
  try { client = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")).iss; } catch { throw new LtiError("Invalid content-selection response."); }
  const tool = await getRawDb().prepare("SELECT * FROM lti_tools WHERE client_id=? AND enabled=1").bind(String(client)).first<LtiTool>(); if (!tool) throw new LtiError("Unregistered content-selection tool.", 401);
  const claims = await verifyToolJwt(tool, token, ltiIssuer());
  if (claims[ltiClaim + "message_type"] !== "LtiDeepLinkingResponse" || claims[ltiClaim + "version"] !== "1.3.0" || claims[ltiClaim + "deployment_id"] !== tool.deployment_id) throw new LtiError("Invalid deep-link response type or deployment.");
  const data = String(claims[ltiDlClaim + "data"] || ""); const values = claims[ltiDlClaim + "content_items"];
  if (!Array.isArray(values) || values.length !== 1 || values[0]?.type !== "ltiResourceLink") throw new LtiError("Select one LTI learning activity.");
  const selected = values[0]; const lti = normalizeExternalActivity({ toolId: tool.id, launchUrl: validateToolTarget(tool, String(selected.url || "")), custom: selected.custom });
  const result = { title: String(selected.title || "External interactive activity").slice(0, 240), instructions: String(selected.text || "Complete the interactive activity and return to this lesson.").slice(0, 12000), lti };
  const saved = await getRawDb().prepare("UPDATE lti_content_selections SET result_json=?,used_at=? WHERE data_hash=? AND tool_id=? AND expires_at>? AND used_at IS NULL").bind(JSON.stringify(result), now(), hash(data), tool.id, now()).run();
  if (!saved.meta.changes) throw new LtiError("This content selection has expired or was already used.", 409);
  return result;
}
export async function ltiActivitiesForTool(toolId: string, code: string) {
  const rows = await getRawDb().prepare("SELECT DISTINCT activity_id,activity_json FROM lti_resource_users WHERE tool_id=? AND course_code=?").bind(toolId, code).all<{ activity_id: string; activity_json: string }>();
  return [...new Map(rows.results.map(r => [r.activity_id, JSON.parse(r.activity_json) as StructuredLearningActivity])).values()];
}
export function ltiLineitem(code: string, activity: StructuredLearningActivity) {
  return { id: `${ltiIssuer()}/api/lti/ags/${encodeURIComponent(code)}/lineitems/${encodeURIComponent(activity.id)}`, scoreMaximum: activity.maxMark || 100, label: activity.title, resourceId: activity.id, resourceLinkId: `${code}:${activity.id}`, tag: "learning-activity" };
}
export async function recordLtiScore(tool: LtiTool, code: string, activityId: string, raw: unknown) {
  const score = raw as { userId?: string; timestamp?: string; scoreGiven?: number | null; scoreMaximum?: number; activityProgress?: string; gradingProgress?: string; comment?: string };
  if (!score || typeof score !== "object" || typeof score.userId !== "string" || !score.userId || typeof score.timestamp !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(score.timestamp) || !Number.isFinite(Date.parse(score.timestamp)) || Date.parse(score.timestamp) > Date.now() + 300000 || !["Initialized", "Started", "InProgress", "Submitted", "Completed"].includes(String(score.activityProgress)) || !["FullyGraded", "Pending", "PendingManual", "Failed", "NotReady"].includes(String(score.gradingProgress))) throw new LtiError("Provide the learner, timestamp, activity progress and grading progress.");
  if (score.scoreGiven !== undefined && score.scoreGiven !== null && (typeof score.scoreGiven !== "number" || !Number.isFinite(score.scoreGiven) || score.scoreGiven < 0 || typeof score.scoreMaximum !== "number" || !Number.isFinite(score.scoreMaximum) || score.scoreMaximum <= 0)) throw new LtiError("The score must have a non-negative value and a positive maximum.");
  const row = await getRawDb().prepare("SELECT * FROM lti_resource_users WHERE tool_id=? AND course_code=? AND activity_id=? AND subject=?").bind(tool.id, code, activityId, score.userId).first<{ user_email: string; activity_json: string; last_score_timestamp: string | null }>();
  if (!row) throw new LtiError("This tool has no learner launch for that course activity.", 403);
  const course = await enrolledCourse(row.user_email, code); if (!course) throw new LtiError("The learner is no longer enrolled.", 403);
  const activity = ensureStructuredLearningActivities(parseRecord(course.materials_json, []), parseRecord(course.activities_json, [])).find(a => a.id === activityId);
  if (!activity?.lti || activity.lti.toolId !== tool.id || !activity.materialId) throw new LtiError("The activity is no longer assigned to this tool.", 403);
  const timestamp = new Date(score.timestamp).toISOString(), payload = JSON.stringify(score), payloadHash = hash(payload);
  const maximum = Math.max(1, activity.maxMark || 100), threshold = activity.passMark || 60;
  const final = score.gradingProgress === "FullyGraded" && score.activityProgress === "Completed" && score.scoreGiven !== null && score.scoreGiven !== undefined;
  const mark = final ? Math.round(Math.min(1, score.scoreGiven! / score.scoreMaximum!) * maximum * 100) / 100 : null;
  const passed = final && mark! / maximum * 100 >= threshold;
  const feedback = String(score.comment || (final ? `The external activity returned ${mark}/${maximum}. ${passed ? "The required standard was met." : "Review the activity feedback and try again if permitted by the tool."}` : "The external activity has not returned a completed, fully graded result.")).slice(0, 12000);
  const result = getRawDb().transaction(db => {
    const current = db.prepare("SELECT last_score_timestamp FROM lti_resource_users WHERE tool_id=? AND course_code=? AND activity_id=? AND subject=?").get(tool.id, code, activityId, score.userId!) as { last_score_timestamp: string | null };
    const duplicate = db.prepare("SELECT id FROM lti_score_events WHERE tool_id=? AND course_code=? AND activity_id=? AND subject=? AND payload_hash=?").get(tool.id, code, activityId, score.userId!, payloadHash);
    if (duplicate) return { duplicate: true, ignored: true, passed, changedGrade: false };
    if (current.last_score_timestamp && Date.parse(timestamp) <= Date.parse(current.last_score_timestamp)) return { duplicate: false, ignored: true, passed, changedGrade: false };
    db.prepare("INSERT INTO lti_score_events(tool_id,course_code,activity_id,subject,payload_hash,timestamp,payload_json) VALUES(?,?,?,?,?,?,?)").run(tool.id, code, activityId, score.userId!, payloadHash, timestamp, payload);
    db.prepare("UPDATE lti_resource_users SET last_score_timestamp=? WHERE tool_id=? AND course_code=? AND activity_id=? AND subject=?").run(timestamp, tool.id, code, activityId, score.userId!);
    // Partial progress is recorded but cannot overwrite a completed grade. An explicit null score clears it.
    if (!final && score.scoreGiven !== null && score.scoreGiven !== undefined) return { duplicate: false, ignored: false, passed: false, changedGrade: false };
    const previous = db.prepare("SELECT id,mark,passed,status FROM material_activity_submissions WHERE user_email=? AND course_code=? AND activity_id=? AND attempt_number=1").get(row.user_email,code,activityId) as {id:number;mark:number;passed:number;status:string}|undefined;
    db.prepare(`INSERT INTO material_activity_submissions(user_email,course_code,material_id,activity_id,attempt_number,response_type,response_text,status,mark,max_mark,pass_mark,passed,feedback,criteria_json,grading_mode,model,assessed_at)
      VALUES(?,?,?,?,1,'link',?,?,?,?,?,?,?,'[]','lti',?,?)
      ON CONFLICT(user_email,course_code,activity_id,attempt_number) DO UPDATE SET status=excluded.status,mark=excluded.mark,max_mark=excluded.max_mark,pass_mark=excluded.pass_mark,passed=excluded.passed,feedback=excluded.feedback,response_text=excluded.response_text,model=excluded.model,assessed_at=excluded.assessed_at`)
      .run(row.user_email, code, activity.materialId!, activityId, payload, final ? "assessed" : "submitted", mark, maximum, threshold, passed ? 1 : 0, feedback, tool.name, final ? timestamp : null);
    const stored = db.prepare("SELECT id FROM material_activity_submissions WHERE user_email=? AND course_code=? AND activity_id=? AND attempt_number=1").get(row.user_email,code,activityId) as {id:number};
    db.prepare("INSERT INTO evidence_grade_history(target_type,target_id,actor_email,before_json,after_json,reason) VALUES('inline',?,?,?,?,?)").run(stored.id,`lti:${tool.id}`,JSON.stringify(previous ? {mark:previous.mark,passed:previous.passed,status:previous.status} : {}),JSON.stringify({mark,passed,status:final?"assessed":"submitted"}),feedback);
    return { duplicate: false, ignored: false, passed, changedGrade: true };
  });
  if(result.changedGrade&&!result.passed&&activity.required)await reviewAffectedCredential(row.user_email,code,"Required external activity result was corrected or cleared.");
  return { ...result, email: row.user_email };
}
export function ltiErrorResponse(error: unknown) { return Response.json({ error: error instanceof Error ? error.message : "The external learning request failed." }, { status: error instanceof LtiError ? error.status : 500, headers: { "cache-control": "no-store" } }); }
