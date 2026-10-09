import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateKeyPairSync } from "node:crypto";
import { exportJWK, SignJWT, createLocalJWKSet, jwtVerify } from "jose";
import { getRawDb } from "../src/db/raw";
import { ensureLtiTables, initiateLtiLaunch, authorizeLti, issueLtiToken, ltiMetadata, platformJwks, recordLtiScore, getLtiTool, receiveDeepLink, requireLtiService, ltiLineitem } from "../src/lib/lti-platform";
import { ltiClaim, ltiDlClaim, ltiAgsClaim, ltiScopes } from "../src/lib/lti-types";
import type { AccountProfile } from "../src/lib/accounts";
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "ucc-lti-")); process.env.SQLITE_PATH = join(process.env.DATA_DIR, "test.sqlite"); process.env.AUTH_SECRET = "isolated-lti-test-secret"; process.env.NEXT_PUBLIC_APP_URL = "https://platform.example.test";
const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const learner = { email: "learner@example.test", role: "learner", full_name: "Test learner", identity_status: "verified" } as AccountProfile;
const author = { email: "author@example.test", role: "facilitator", full_name: "Test author" } as AccountProfile;
const activity = { id: "external", kind: "inline", materialId: "lesson", sectionId: "section", title: "External practice", instructions: "Complete it", required: true, passMark: 60, maxMark: 100, attemptsAllowed: 3, gradingMode: "lti", lti: { toolId: "tool", launchUrl: "https://tool.example.test/content/123", custom: { content_id: "123" } } };
let subject = "", tick = Date.now() - 20000;
async function setup() {
  ensureLtiTables(); const db = getRawDb(), jwk = { ...await exportJWK(keys.publicKey), kid: "test-tool", alg: "RS256", use: "sig" };
  for (const [email, role] of [[learner.email, "learner"], [author.email, "facilitator"]]) await db.prepare("INSERT INTO users(email,full_name,role,status,identity_status) VALUES(?,? ,?,'active','verified')").bind(email, "Test user", role).run();
  await db.prepare("INSERT INTO lti_tools(id,name,client_id,deployment_id,login_url,redirect_uris_json,jwks_json,origins_json,deep_link_url,created_by_email) VALUES('tool','Mock H5P','client','deployment','https://tool.example.test/login',?,?,?,'https://tool.example.test/select',?)").bind(JSON.stringify(["https://tool.example.test/launch"]), JSON.stringify({ keys: [jwk] }), JSON.stringify(["https://tool.example.test"]), author.email).run();
  await db.prepare("INSERT INTO course_drafts(code,title,materials_json,activities_json,design_json,status,created_by_email) VALUES('LTI-COURSE','External test',?,?,?,'active',?)").bind(JSON.stringify([{ id: "lesson", title: "Lesson", kind: "Read", sectionId: "section" }]), JSON.stringify([activity]), JSON.stringify({ delivery: { identityRequired: "before_learning" } }), author.email).run();
  await db.prepare("INSERT INTO enrollments(user_email,course_code,status) VALUES(?,'LTI-COURSE','active')").bind(learner.email).run();
}
const paramsFor = (url: string) => { const hint = new URL(url).searchParams.get("login_hint")!; return new URLSearchParams({ scope: "openid", response_type: "id_token", response_mode: "form_post", prompt: "none", client_id: "client", redirect_uri: "https://tool.example.test/launch", login_hint: hint, lti_message_hint: hint, nonce: "nonce-12345678", state: "state-12345678" }); };
async function assertion(extra = {}) { return new SignJWT({ ...extra }).setProtectedHeader({ alg: "RS256", kid: "test-tool" }).setIssuer("client").setSubject("client").setAudience(ltiMetadata().tokenEndpoint).setIssuedAt().setExpirationTime("5m").setJti(crypto.randomUUID()).sign(keys.privateKey); }
async function tokenParams(token: string, scope = ltiScopes.score) { return new URLSearchParams({ grant_type: "client_credentials", client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer", client_assertion: token, scope }); }
const score = (value: number | null = 8) => ({ userId: subject, scoreGiven: value, scoreMaximum: 10, timestamp: new Date(tick += 1000).toISOString(), activityProgress: "Completed", gradingProgress: "FullyGraded", comment: "Specific feedback from the tool." });
test("LTI signs learner launches, keeps identity private, validates the redirect and consumes each hint once", async () => {
  await setup(); const launch = await initiateLtiLaunch(learner, { courseCode: "LTI-COURSE", activityId: "external" });
  const bad = paramsFor(launch.url); bad.set("redirect_uri", "https://attacker.example/steal"); await assert.rejects(() => authorizeLti(learner, bad), /redirect URI/);
  await assert.rejects(() => authorizeLti(author, paramsFor(launch.url)), /another signed-in account/);
  const result = await authorizeLti(learner, paramsFor(launch.url)), { payload } = await jwtVerify(result.idToken, createLocalJWKSet(await platformJwks()), { issuer: ltiMetadata().issuer, audience: "client", algorithms: ["RS256"] });
  const originalSecret=process.env.AUTH_SECRET;process.env.AUTH_SECRET="changed-secret-must-not-rotate-key";try{await assert.rejects(()=>platformJwks(),/Restore its original AUTH_SECRET/);}finally{process.env.AUTH_SECRET=originalSecret;}
  subject = payload.sub!; assert.notEqual(subject, learner.email); assert.equal(payload.email, undefined); assert.equal(payload.name, undefined); assert.equal(payload.nonce, "nonce-12345678"); assert.equal(payload[ltiClaim + "message_type"], "LtiResourceLinkRequest"); assert.ok(payload[ltiAgsClaim + "endpoint"]);
  await assert.rejects(() => authorizeLti(learner, paramsFor(launch.url)), /expired, used/);
});
test("Tool assertions require a valid signature, audience and unique jti, and service tokens enforce scope", async () => {
  const signed = await assertion(), params = await tokenParams(signed); const access = await issueLtiToken(params);
  assert.equal(access.token_type, "Bearer"); await assert.rejects(() => issueLtiToken(params), /already used/);
  const pieces=signed.split(".");pieces[2]=pieces[2].slice(0,10)+(pieces[2][10]==="A"?"B":"A")+pieces[2].slice(11);const tampered=await tokenParams(pieces.join("."));await assert.rejects(()=>issueLtiToken(tampered),/could not be verified/);
  const expired=await new SignJWT({}).setProtectedHeader({alg:"RS256",kid:"test-tool"}).setIssuer("client").setSubject("client").setAudience(ltiMetadata().tokenEndpoint).setIssuedAt(Math.floor(Date.now()/1000)-400).setExpirationTime(Math.floor(Date.now()/1000)-60).setJti("expired").sign(keys.privateKey);const expiredParams=await tokenParams(expired);await assert.rejects(()=>issueLtiToken(expiredParams),/could not be verified/);
  const wrong = await new SignJWT({}).setProtectedHeader({ alg: "RS256", kid: "test-tool" }).setIssuer("client").setSubject("client").setAudience("https://attacker.example").setIssuedAt().setExpirationTime("5m").setJti("bad").sign(keys.privateKey);
  const wrongParams=await tokenParams(wrong); await assert.rejects(() => issueLtiToken(wrongParams), /could not be verified/);
  const request = new Request("https://platform.example.test", { headers: { authorization: `Bearer ${access.access_token}` } }); assert.equal((await requireLtiService(request, ltiScopes.score)).id, "tool"); await assert.rejects(() => requireLtiService(request, ltiScopes.results), /cannot access/);
});
test("Authenticated external scores scale into evidence, deduplicate retries and ignore stale or partial grades", async () => {
  const tool = await getLtiTool("tool"), data = score(); const result = await recordLtiScore(tool, "LTI-COURSE", "external", data); assert.equal(result.passed, true);
  const before = await getRawDb().prepare("SELECT * FROM material_activity_submissions WHERE activity_id='external'").first<{ mark: number; feedback: string; passed: number }>(); assert.equal(before?.mark, 80); assert.equal(before?.feedback, data.comment); assert.equal(before?.passed, 1);
  assert.equal((await recordLtiScore(tool, "LTI-COURSE", "external", data)).duplicate, true);
  assert.equal((await recordLtiScore(tool, "LTI-COURSE", "external", { ...data, scoreGiven: 1, timestamp: new Date(tick - 1000).toISOString() })).ignored, true);
  await recordLtiScore(tool, "LTI-COURSE", "external", { ...score(1), gradingProgress: "PendingManual", activityProgress: "InProgress" });
  assert.equal((await getRawDb().prepare("SELECT mark FROM material_activity_submissions WHERE activity_id='external'").first<{ mark: number }>())?.mark, 80);
  await assert.rejects(() => recordLtiScore(tool, "LTI-COURSE", "external", { ...score(), userId: "another-learner" }), /no learner launch/);
});
test("A lower or cleared external result removes its pass and sends an issued credential for review", async () => {
  const db = getRawDb(); await db.prepare("INSERT INTO certificates(certificate_code,user_email,learner_name,course_code,course_title) VALUES('LTI-CERT',?,'Learner','LTI-COURSE','External')").bind(learner.email).run();
  await recordLtiScore(await getLtiTool("tool"), "LTI-COURSE", "external", score(null));
  assert.equal((await db.prepare("SELECT passed FROM material_activity_submissions WHERE activity_id='external'").first<{ passed: number }>())?.passed, 0);
  assert.equal((await db.prepare("SELECT status FROM certificates WHERE certificate_code='LTI-CERT'").first<{ status: string }>())?.status, "under_review");
  assert.ok(await db.prepare("SELECT id FROM credential_reviews WHERE certificate_code='LTI-CERT'").first());
});
test("Instructor previews have no grade service or learner evidence, and deep links require a signed single-use response", async () => {
  const launch = await initiateLtiLaunch(author, { courseCode: "LTI-COURSE", activityId: "external" }), result = await authorizeLti(author, paramsFor(launch.url)); const { payload } = await jwtVerify(result.idToken, createLocalJWKSet(await platformJwks())); assert.equal(payload[ltiAgsClaim + "endpoint"], undefined);
  const deep = await initiateLtiLaunch(author, { courseCode: "LTI-COURSE", toolId: "tool", deepLink: true }), deepLaunch = await authorizeLti(author, paramsFor(deep.url)), claims = (await jwtVerify(deepLaunch.idToken, createLocalJWKSet(await platformJwks()))).payload;
  const settings = claims[ltiDlClaim + "deep_linking_settings"] as { data: string };
  const signed = await new SignJWT({ [ltiClaim + "message_type"]: "LtiDeepLinkingResponse", [ltiClaim + "version"]: "1.3.0", [ltiClaim + "deployment_id"]: "deployment", [ltiDlClaim + "data"]: settings.data, [ltiDlClaim + "content_items"]: [{ type: "ltiResourceLink", title: "Interactive video", url: "https://tool.example.test/content/999", custom: { content_id: "999" } }] }).setProtectedHeader({ alg: "RS256", kid: "test-tool" }).setIssuer("client").setAudience(ltiMetadata().issuer).setIssuedAt().setExpirationTime("5m").sign(keys.privateKey);
  const selected = await receiveDeepLink(signed); assert.equal(selected.title, "Interactive video"); assert.equal(selected.lti?.custom.content_id, "999"); await assert.rejects(() => receiveDeepLink(signed), /already used/);
  assert.equal(ltiLineitem("LTI-COURSE", activity as Parameters<typeof ltiLineitem>[1]).resourceLinkId, "LTI-COURSE:external");
});
