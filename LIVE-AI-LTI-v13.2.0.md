# UCC Growth+ v13.2.0

This update adds real AI diagnostics, connected H5P/LTI activities and saved section-by-section course generation to the v13.1.0 Facilitator Studio. The complete application source is included.

## Facilitator workflow

1. Describe the audience, goals, level, duration, delivery and award.
2. Generate and edit the outline. Approve the sections and outcomes.
3. Develop one saved section at a time. The request list shows completed sections. A failed request can resume its unfinished sections without repeating completed provider calls.
4. Edit lessons and native practice, or select a registered H5P/LTI activity.
5. Test the learner experience, confirm outcome links and submit for academic approval.

The request list resumes queued stages while the designer is open. Leaving the page does not discard completed sections. Return to the designer to continue. Workers use exclusive leases. A worker lost for ten minutes is marked failed and requires an explicit resume. Saved inputs and child proposals are private to their owner.

Approved section titles and outcome meanings are retained when combining lessons. Links are remapped only when generated outcome statements match approved statements, with no positional guesses. Each lesson, question and activity receives a distinct identifier. Facilitator confirmation is still required.

## Live AI verification

Configure the existing OpenAI or Vertex credentials on the server. Administrators can open **Live AI verification** under Programme governance in the Administrator Portal and run a small actual generation task. It uses the normal saved-job pipeline and daily allowance, but never applies its content to a course.

The diagnostic records the provider, model, completion time and six checks: structured response, developed lessons, valid assessment keys, valid native practice, explicit outcome links with reasons, and at least one exact supporting source excerpt. A provider response with failed quality checks is reported as needing review. An unavailable provider is not reported as verified.

From a source checkout with dependencies installed, run:

```sh
npm run ai:verify:live
npm run ai:verify:live -- openai
npm run ai:verify:live -- vertex
```

Exit code 0 means all checks passed. Code 1 means a request or quality check failed. Code 2 means credentials are absent. Administrators can also inspect institutional AI usage and set daily limits under Programme governance. The browser diagnostic is the supported option in the production standalone container, which does not include development dependencies such as tsx.

Automatic provider selection chooses one configured provider for each generation call. It does not silently make another provider call after failure. Choose another provider explicitly when starting a new request. Daily usage reserves one call for an outline or diagnostic and one per developed section. A resume reserves only unfinished sections. Failed reservations are retained for that day. OCR extraction and external tool fees are separate from these authoring estimates. Token estimates use the deployment's configured rates.

## Connect H5P.com or another LTI 1.3 tool

This application acts as an LTI platform. It does not host an H5P content library. Obtain an institutional H5P.com account or another tool that supports LTI 1.3 resource launches and Assignment and Grade Services. Ordinary iframe content does not provide an authenticated grade return through this integration.

1. Set `NEXT_PUBLIC_APP_URL` to the stable public HTTPS platform address. Keep `AUTH_SECRET` and the persistent data disk stable. Leave `LTI_PLATFORM_ISSUER` blank unless it must explicitly specify that same public address.
2. In the Administrator Portal, open Programme governance and **H5P and LTI connections**. Register the exact login initiation URL, redirect URI or URIs, allowed content origins, public JWKS URL or public RSA key set, and an optional Deep Linking content-selection URL supplied by the tool. Do not guess these endpoints. Multiple origins may be necessary if the tool's content and login use different hosts.
3. Save the registration. Copy the generated client ID and deployment ID, plus the displayed platform issuer, authorization endpoint, token endpoint, public key-set URL and Deep Linking return URL into the tool's platform registration. Follow the tool's own registration process.
4. Check the tool's public signing keys. This establishes key validity only. Complete a learner launch and grade return before treating the connection as fully verified.
5. In **Build content**, select a lesson and expand **Add H5P or another connected activity**. Select content inside a tool with Deep Linking, or enter its approved LTI activity launch URL and required custom parameters. Review the selected title and instructions, preview the activity, then apply and save it.
6. External practice is optional initially. In the lesson editor, set its maximum mark, pass threshold and whether it is required for completion. Configure attempt limits and accessibility in the tool itself.

Activities open in a separate browser tab. This avoids depending on third-party iframe cookies. Learners return to the lesson to see their authenticated result and feedback. The platform polls after launch and refreshes results when the window regains focus. Tool feedback should be educational and specific. If none is supplied, the platform records a clear result explanation.

The supported services are LTI 1.3 OpenID launches, signed Deep Linking selection, OAuth client assertions, score submission, and read-only line items and results for platform-created activities. This release does not implement Names and Role Provisioning, dynamic registration, external line-item creation, SCORM import or an H5P self-hosting service. It is not a claim of 1EdTech certification. Register and validate the institution's actual tool before production use.

## Grade return, permissions and completion

External results are accepted only for a learner who launched that registered activity and remains enrolled in its course snapshot. Tokens require the advertised scope. Expired tokens, invalid signatures, assertion replays, unknown subjects and unregistered URLs are rejected. Grade values are scaled to the platform maximum. Only a completed, fully graded numeric result can pass a required activity.

Exact score callbacks are idempotent. Older or equally timed callbacks cannot overwrite a newer result. Partial progress is recorded without replacing a completed numeric grade. A cleared score removes its pass. A lower or cleared required grade sends an issued credential for review. External grade changes appear in the existing facilitator evidence gradebook and its history. The connected tool remains authoritative for subsequent grade callbacks, including after a manual adjustment.

Learners cannot submit an external mark through the ordinary activity endpoint. The lesson-progress API also refuses to mark a lesson complete while a required inline activity is unpassed. Final assessment and credential rules continue to evaluate all required evidence.

Facilitator previews use instructor roles and omit grade-service endpoints. Content selections remain private to the facilitator and require review before application. The default launch shares a stable random subject identifier. Learner name and email are shared only if an administrator explicitly enables them for that registration.

## Source support and larger manuals

Text PDFs are extracted in page order with actual page numbers. Extraction stops at 400 pages or approximately 600,000 text characters, with a notice when limited. Scanned PDFs use the existing AI extraction path where configured. They receive no invented page references.

Section generation selects relevant source passages using terms from the approved section title and purpose. The preview lists passages supplied to the provider and counts their combined unique character coverage. This describes input coverage, not proof that every source claim was understood or verified. Weak relevance and uncovered content are flagged for facilitator review. The outline request still uses up to 90,000 characters. Check a long manual's missing topics before approving that outline.

PDF references are attached only to exact excerpts found in the extracted text. Optional reviewed media transcripts may include times such as `02:30` or `01:02:30`. Timestamp references come from those supplied lines. Audio/video analysis does not manufacture timestamps. Other document formats retain exact excerpts and character-range coverage without invented pages or slide numbers.

## Deployment and validation

Back up the existing database and uploads. Keep the same disk and environment variables. Upload the complete extracted project to the repository root and preserve its `src` structure. Use Node 22.13 or newer, run `npm ci`, then run:

```sh
npm run pilot:check
npm run test:api
npm run test:studio:api
npm run test:browser
npm run test:studio:browser
npm run test:integrations
```

Browser checks require Playwright and Chromium. Integration checks use temporary databases and a simulated external tool with real RSA signatures. They never contact a live H5P account. PDF worker and native canvas dependencies are traced into the standalone build.

New tables and the AI request-unit column are created automatically when the corresponding feature is first used. The default signing key is encrypted in the database using `AUTH_SECRET`. Alternatively provide the original PKCS8 RSA private key as `LTI_PLATFORM_PRIVATE_KEY_BASE64`. Do not replace the signing key or secret without a planned tool re-registration or key migration.

See `VALIDATION-LIVE-AI-LTI-v13.2.0.md` for the exact test results and live-service limits. v13.1.0 documentation remains as historical context.

## Protocol references

- [LTI Core 1.3](https://www.imsglobal.org/spec/lti/v1p3/)
- [LTI security framework](https://www.imsglobal.org/spec/security/v1p0/)
- [Assignment and Grade Services](https://www.imsglobal.org/spec/lti-ags/v2p0/)
- [Deep Linking](https://www.imsglobal.org/spec/lti-dl/v2p0/)
- [H5P integration overview](https://h5p.com/integration)
