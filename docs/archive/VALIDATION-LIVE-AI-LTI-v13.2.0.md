# v13.2.0 validation record

Validated locally on 9 October 2026 with Node 22.23.3, Chromium 153 and the Next.js production standalone server. Acceptance checks used temporary SQLite databases, synthetic users and courses. External payment, email and AI credentials were removed from those isolated environments.

| Check | Result | Evidence |
| --- | --- | --- |
| Production standalone build | Passed | `validation/live-ai-lti/checks/build.log` |
| Application and test TypeScript | Passed | `validation/live-ai-lti/checks/typecheck.log` |
| ESLint | 0 errors, 42 existing warnings | `validation/live-ai-lti/checks/lint.log` |
| Unit tests | 85 total, 82 passed, 3 capability skips, 0 failed | `validation/live-ai-lti/checks/unit-tests.log` |
| Existing commercial API acceptance | 46 checks passed | `validation/live-ai-lti/regression/api-results.json` |
| Native activity and authoring API acceptance | 23 checks passed | `validation/live-ai-lti/native/api-results.json` |
| Existing commercial browser acceptance | 14 checks passed | `validation/live-ai-lti/regression/browser/browser-results.json` |
| Native practice and authoring browser acceptance | 14 checks passed | `validation/live-ai-lti/native/browser/studio-browser-results.json` |
| External-tool and AI diagnostic acceptance | 25 production API/browser checks passed | `validation/live-ai-lti/integration-results.json` |
| Live AI provider command | Not configured, exit code 2 | `validation/live-ai-lti/checks/live-ai-verification.log` |

## What was exercised

The integration acceptance test registers a simulated tool with a real RSA key pair. A mobile browser initiates its login, receives and verifies the signed platform launch, submits the external activity, obtains an authenticated OAuth token and returns a score through the production grade endpoint. The learner sees the scaled mark and feedback. The required lesson and final-assessment gates open only after a passing returned result and completed learning.

The same test checks administrator-only registration, allowed origins, public platform keys, private subjects, scoped result reads, replay rejection, forbidden manual external marks, facilitator preview isolation, the launch route's destination-specific content policy, signed Deep Linking selection, private facilitator review, gradebook history and phone-width administration screens. It uses a mock external service. It does not establish a live H5P.com account connection or certify the platform against every LTI conformance test.

Unit tests additionally verify tampered and expired assertions, original signing-secret protection, duplicate/stale score callbacks, partial progress, score clearing and credential review. Source tests extract an actual two-page PDF and verify its page references, supplied transcript timestamps and selection of relevant content beyond the first 90,000 characters. The production upload check confirms PDF worker dependencies are present in the standalone output.

Staged-generation tests simulate a provider interruption after a saved first section. The retry invokes only the unfinished section, retains approved titles and outcome meanings, creates distinct content IDs, maps outcomes by statements rather than position, and reports unique source coverage and actual token usage. Daily reservations account for every planned section before generation starts.

The AI diagnostic distinguishes a structured provider response from failed quality checks. Without credentials, it returns not configured and makes no live provider request. The administrator screen disables live verification until a provider is configured. The command and queued diagnostic can be run against the deployment's actual configured provider after setup.

Commercial regression checks retain human marking, role permissions, moderation, discussions, cohort/intake creation, support, receipt downloads, certificate generation and downward-grade review. Native authoring checks retain editable practice, reusable templates, undo, saved proposals, answer correction, learner response recovery, server-side grading and phone layouts.

## Live-service limits and follow-up

No live OpenAI or Vertex generation was verified because this workspace has no provider credentials. No live H5P.com registration was available. No deployment, live payment, outbound email, Docker execution or the user's Render environment was exercised. Three existing storage tests require operating-system capabilities absent from this workspace and were skipped.

Before production promotion, configure the selected AI provider and run Live AI verification. Register the institution's actual H5P/LTI tool, launch an instructor preview, select content, complete a real learner activity and confirm its grade appears in progress and the gradebook. Verify its accessibility and completion behavior with a small approved staging course. These concrete setup steps are described in `LIVE-AI-LTI-v13.2.0.md`.
