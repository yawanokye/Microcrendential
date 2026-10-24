# AI Course Studio release — 14 September 2026

This release extends the facilitator Course Studio with three governed authoring paths:

1. Build and edit a course manually.
2. Upload a full learning manual and convert it into an editable course draft, with OpenAI enhancement when configured and deterministic extraction as a fallback.
3. Enter or upload a synopsis/idea and ask OpenAI to create a complete editable draft, including lessons, outcomes, activities, rubrics, assessment questions and resource-search recommendations.

## Added capabilities

- Provider-independent, server-side AI adapter for OpenAI and Google Vertex AI.
- Workload-aware OpenAI routing: Luna for fast refinement, Terra for complete generation/manual conversion, and Sol for rigorous academic review.
- Facilitator-selectable AI review depth with automatic balanced routing for manual and synopsis imports.
- Structured OpenAI course-design output validated with strict schemas.
- AI output normalization now caps every learning block at 240 minutes and every course assessment set at 12 questions before final validation. This prevents otherwise valid model output from causing `/api/course-ai/design` to return HTTP 502.
- Gemini Flash analysis for a public YouTube video or authorised `gs://` video/audio source.
- Facilitator review dialogs; AI never saves, submits, approves or publishes automatically.
- Suggested YouTube/open-resource searches with a separate verification action before a facilitator adds a resource.
- Original uploaded manual remains attached while extracted sections become readable course lessons.
- Human approval, licensing, accessibility and factual-verification reminders.
- AI operations protected by authentication, role checks, same-origin mutation checks, size limits, timeouts and audit entries.
- Exact supplied UCC crest installed in both the certificate source assets and the public runtime assets.

## Render configuration

See `AI_COURSE_STUDIO_SETUP.md` and `.env.example`. Keep every API key server-side. At minimum:

- `OPENAI_API_KEY`
- `OPENAI_COURSE_MODEL` (optional override)
- `GOOGLE_CLOUD_PROJECT`
- `GOOGLE_CLOUD_LOCATION`
- `GOOGLE_VERTEX_MODEL` (optional override)
- `GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON_BASE64` (recommended) or another documented credential option

## Verification completed

- `npm test`: 14 tests passed, including a regression test for oversized AI lesson durations and question sets.
- `npm run build`: Next.js 16.3.5 production compilation, TypeScript validation and generation of all 55 routes passed.
- `npm run lint`: 0 errors; 13 existing non-blocking warnings remain.
- `npm audit --omit=dev`: 0 production dependency vulnerabilities after the Next.js security update and safe audit fixes.

## Deployment note

Upload this release at the repository root. Do not upload an enclosing parent folder or `node_modules`. Configure the environment variables in Render before redeploying, then verify `/api/health/live`, authenticated Course Studio access and one small AI request for each configured provider.
