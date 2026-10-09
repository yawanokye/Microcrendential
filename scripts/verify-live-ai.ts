import { runLiveAiVerification } from "../src/lib/course-ai-verification";
import type { CourseAiProvider } from "../src/lib/course-ai";
const provider = process.argv[2] || "auto";
if (!["auto", "openai", "vertex"].includes(provider)) throw new Error("Choose auto, openai or vertex.");
try { const result = await runLiveAiVerification(provider as CourseAiProvider); console.log(JSON.stringify(result, null, 2)); if (result.status !== "passed") process.exitCode = result.status === "not_configured" ? 2 : 1; }
catch (e) { let message = e instanceof Error ? e.message : "Verification failed."; if (process.env.OPENAI_API_KEY) message = message.replaceAll(process.env.OPENAI_API_KEY, "[redacted]"); console.log(JSON.stringify({ status: "failed", message, checkedAt: new Date().toISOString() }, null, 2)); process.exitCode = 1; }
