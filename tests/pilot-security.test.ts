import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createPasswordRecord, passwordMatches, validatePassword } from "../src/lib/passwords";
import { hasExecutableSignature, validateIdentityUpload } from "../src/lib/file-security";

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

test("official pilot deployment keeps manual promotion and payments off", () => {
  const blueprint = readFileSync(new URL("../render.yaml", import.meta.url), "utf8");
  const security = readFileSync(new URL("../next.config.mjs", import.meta.url), "utf8");
  assert.match(blueprint, /autoDeploy: false/);
  assert.match(blueprint, /key: PAYMENTS_ENABLED\s+value: "false"/);
  assert.match(blueprint, /key: STAFF_MFA_REQUIRED\s+value: "true"/);
  assert.match(security, /default-src 'self'/);
  assert.match(security, /upgrade-insecure-requests/);
});
