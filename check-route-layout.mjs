import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sourceLayoutIssues } from "./next.config.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const routes = [
  ["src/app/page.tsx", "@/components/platform-home"],
  ["src/app/facilitator-studio/page.tsx", "@/components/platform-home"],
  ["src/app/learn/page.tsx", "@/components/learning-page"],
];
const errors = sourceLayoutIssues(root);
for (const [path, module] of routes) {
  let source;
  try {
    source = readFileSync(resolve(root, path), "utf8");
  } catch {
    errors.push(`${path} is missing. Restore it at this exact path.`);
    continue;
  }
  const imports = [...source.matchAll(/\bimport\s+[^;]*?\bfrom\s*["']([^"']+)["']/g)].map((match) => match[1]);
  if (!imports.includes(module)) {
    errors.push(`${path} must import ${module}. This page may have been uploaded to the wrong folder.`);
  }
}
if (errors.length) {
  console.error("Page layout check failed:\n" + errors.map((error) => `- ${error}`).join("\n"));
  console.error("Extract the complete release ZIP and upload src/ and scripts/ from the repository root. Keep all subfolders. See DEPLOYMENT-FIX-v13.3.1.md.");
  process.exitCode = 1;
} else {
  console.log("Release source checked: required files, canonical imports and the landing, facilitator and learner routes are in their expected locations.");
}
