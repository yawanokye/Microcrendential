import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createPasswordRecord, passwordMatches, validatePassword } from "../src/lib/passwords";
import { hasExecutableSignature, validateIdentityUpload } from "../src/lib/file-security";
import { transactionalEmailConfigured, transactionalEmailProvider } from "../src/lib/email";
import { normalizePlatformMode } from "../src/lib/platform-mode";

test("pilot password policy requires a long password and stores a salted hash", () => {
  assert.match(validatePassword("short"), /12/);
  assert.equal(validatePassword("a secure pilot password"), "");
  const stored = createPasswordRecord("a secure pilot password");
  assert.notEqual(stored.passwordHash, "a secure pilot password");
  assert.equal(passwordMatches("a secure pilot password", { password_hash: stored.passwordHash, password_salt: stored.salt }), true);
  assert.equal(passwordMatches("another password", { password_hash: stored.passwordHash, password_salt: stored.salt }), false);
});

test("identity upload validation checks actual file signatures", async () => {
  const png = new File([new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0])], "id.png", { type: "image/png" });
  const spoofed = new File(["not an image"], "id.png", { type: "image/png" });
  const pdf = new File([new Uint8Array([0x25,0x50,0x44,0x46,0x2d,0x31,0x2e,0x37])], "id.pdf", { type: "application/pdf" });
  assert.equal(await validateIdentityUpload(png, false), true);
  assert.equal(await validateIdentityUpload(spoofed, true), false);
  assert.equal(await validateIdentityUpload(pdf, false), false);
  assert.equal(await validateIdentityUpload(pdf, true), true);
});

test("executable binary signatures are rejected", async () => {
  const windowsBinary = new File([new Uint8Array([0x4d,0x5a,0,0])], "bad.pdf", { type: "application/pdf" });
  assert.equal(await hasExecutableSignature(windowsBinary), true);
});

test("Google Mail can provide transactional authentication email", () => {
  const previous = {
    provider: process.env.EMAIL_PROVIDER,
    user: process.env.GMAIL_USER,
    password: process.env.GMAIL_APP_PASSWORD,
  };
  process.env.EMAIL_PROVIDER = "gmail";
  process.env.GMAIL_USER = "uccgrowth@ucc.edu.gh";
  process.env.GMAIL_APP_PASSWORD = "example-app-password";
  assert.equal(transactionalEmailProvider(), "gmail");
  assert.equal(transactionalEmailConfigured(), true);
  if (previous.provider === undefined) delete process.env.EMAIL_PROVIDER; else process.env.EMAIL_PROVIDER = previous.provider;
  if (previous.user === undefined) delete process.env.GMAIL_USER; else process.env.GMAIL_USER = previous.user;
  if (previous.password === undefined) delete process.env.GMAIL_APP_PASSWORD; else process.env.GMAIL_APP_PASSWORD = previous.password;
});

test("Resend is selected for the Render demonstration", () => {
  const previous = {
    provider: process.env.EMAIL_PROVIDER,
    key: process.env.RESEND_API_KEY,
    from: process.env.EMAIL_FROM,
  };
  process.env.EMAIL_PROVIDER = "resend";
  process.env.RESEND_API_KEY = "re_example_key";
  process.env.EMAIL_FROM = "UCC Growth+ <onboarding@resend.dev>";
  assert.equal(transactionalEmailProvider(), "resend");
  assert.equal(transactionalEmailConfigured(), true);
  if (previous.provider === undefined) delete process.env.EMAIL_PROVIDER; else process.env.EMAIL_PROVIDER = previous.provider;
  if (previous.key === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = previous.key;
  if (previous.from === undefined) delete process.env.EMAIL_FROM; else process.env.EMAIL_FROM = previous.from;
});

test("official pilot deployment keeps manual promotion and payments off", () => {
  const blueprint = readFileSync(new URL("../render.yaml", import.meta.url), "utf8");
  const security = readFileSync(new URL("../next.config.mjs", import.meta.url), "utf8");
  assert.match(blueprint, /autoDeploy: false/);
  assert.match(blueprint, /key: PLATFORM_MODE\s+value: demonstration/);
  assert.match(blueprint, /key: EMERGENCY_DEMONSTRATION_MODE\s+value: "false"/);
  assert.match(blueprint, /key: EMAIL_PROVIDER\s+value: resend/);
  assert.match(blueprint, /key: PAYMENTS_ENABLED\s+value: "false"/);
  assert.match(blueprint, /key: STAFF_MFA_REQUIRED\s+value: "true"/);
  assert.match(security, /default-src 'self'/);
  assert.match(security, /upgrade-insecure-requests/);
});

test("platform mode fails safely to Demonstration", () => {
  assert.equal(normalizePlatformMode(undefined), "demonstration");
  assert.equal(normalizePlatformMode("unknown"), "demonstration");
  assert.equal(normalizePlatformMode("official_pilot"), "official_pilot");
});

test("pilot activation invalidates sessions and Demonstration blocks credential issuance", () => {
  const modeRoute = readFileSync(new URL("../src/app/api/platform-mode/route.ts", import.meta.url), "utf8");
  const certificateRoute = readFileSync(new URL("../src/app/api/certificates/route.ts", import.meta.url), "utf8");
  const completion = readFileSync(new URL("../src/lib/course-completion.ts", import.meta.url), "utf8");
  assert.match(modeRoute, /UPDATE auth_accounts SET session_version = session_version \+ 1/);
  assert.match(certificateRoute, /Official certificate issuance is disabled while the platform is in Demonstration mode/);
  assert.match(completion, /officialCredentialsEnabled/);
});
