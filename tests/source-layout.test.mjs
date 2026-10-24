import assert from "node:assert/strict";
import test from "node:test";
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { requiredReleaseSources, sourceLayoutIssues } from "../next.config.mjs";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "ucc-source-layout-"));
  for (const name of requiredReleaseSources) {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), "// source-layout test fixture\n");
  }
  writeFileSync(join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { paths: { "@/*": ["./src/*"] } }, include: ["src/**/*.ts", "src/**/*.tsx"] }));
  return root;
}

test("A complete release has one canonical src tree", () => {
  assert.deepEqual(sourceLayoutIssues(fixture()), []);
});

test("Misplaced corporate components are reported at the exact required src paths", () => {
  const root = mkdtempSync(join(tmpdir(), "ucc-incomplete-upload-"));
  mkdirSync(join(root, "components"));
  for (const name of ["settings", "review", "learner"]) writeFileSync(join(root, "components", `corporate-assessment-${name}.tsx`), "// misplaced\n");
  const issues = sourceLayoutIssues(root);
  for (const name of ["settings", "review", "learner"]) assert.ok(issues.includes(`Missing src/components/corporate-assessment-${name}.tsx`));
});

test("Unused root component copies cannot become canonical source", () => {
  const root = fixture();
  mkdirSync(join(root, "components"));
  writeFileSync(join(root, "components/platform-home.tsx"), "throw new Error('obsolete duplicate');\n");
  assert.deepEqual(sourceLayoutIssues(root), []);
});

test("Root route folders cannot silently override the intended src routes", () => {
  const root = fixture();
  for (const name of ["app", "pages"]) mkdirSync(join(root, name));
  const issues = sourceLayoutIssues(root);
  for (const name of ["app", "pages"]) assert.ok(issues.some(issue => issue.startsWith(`Root ${name}/ overrides`)));
});

test("A stale alias or broad TypeScript include is rejected before compilation", () => {
  const root = fixture();
  writeFileSync(join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { paths: { "@/*": ["./*"] } }, include: ["**/*.tsx"] }));
  const issues = sourceLayoutIssues(root);
  assert.ok(issues.some(issue => issue.includes("map @/*")));
  assert.ok(issues.some(issue => issue.includes("obsolete root application copies")));
});

test("Malformed TypeScript configuration produces an actionable source error", () => {
  const root = fixture();
  writeFileSync(join(root, "tsconfig.json"), "not JSON");
  assert.ok(sourceLayoutIssues(root).includes("Missing or invalid tsconfig.json. Restore the release configuration."));
});

test("A standalone runtime starts without a src tree while source builds still validate it", async () => {
  const root = mkdtempSync(join(tmpdir(), "ucc-standalone-config-"));
  cpSync(new URL("../next.config.mjs", import.meta.url), join(root, "next.config.mjs"));
  const { default: configuration } = await import(pathToFileURL(join(root, "next.config.mjs")).href);
  assert.equal(configuration("phase-production-server").output, "standalone");
  assert.throws(() => configuration("phase-production-build"), /Release source check failed:[\s\S]*src\/components\/corporate-assessment-settings/);
});
