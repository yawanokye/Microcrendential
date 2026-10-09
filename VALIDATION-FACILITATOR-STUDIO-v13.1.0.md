# v13.1.0 validation record

Validated locally on 9 October 2026 using Node 22.23.3 and the Next.js production standalone server. API and browser checks used temporary databases with synthetic accounts and courses. External AI, payment and email credentials were removed from those environments.

| Check | Result | Evidence |
| --- | --- | --- |
| Production build | Passed | `validation/facilitator-studio/checks/build.log` |
| Application and test TypeScript checks | Passed | `validation/facilitator-studio/checks/typecheck.log` |
| ESLint | 0 errors, 42 existing warnings | `validation/facilitator-studio/checks/lint.log` |
| Unit tests | 74 total: 71 passed, 3 skipped, 0 failed | `validation/facilitator-studio/checks/unit-tests.log` |
| Existing commercial API acceptance | 46 checks passed | `validation/facilitator-studio/regression/api-results.json` |
| New authoring and native-activity API acceptance | 23 checks passed | `validation/facilitator-studio/api-results.json` |
| Existing learner and facilitator browser acceptance | 14 checks passed | `validation/facilitator-studio/browser/browser-results.json` |
| New authoring and interactive-practice browser acceptance | 14 checks passed | `validation/facilitator-studio/browser/studio-browser-results.json` |

## What the checks establish

- Invalid AI multiple-choice answers remain unresolved. Outcome links use explicit proposed mappings, rather than section position. Unconfirmed AI lessons and outline placeholders block publication.
- Selective improvement preserves an existing course's identity, fees, certificate settings, governance, activities, assessment settings and approved questions.
- Durable AI request tests use a simulated provider to check saved responses, usage counts, exclusive worker claims, daily limits and stale-worker failure. Browser fixtures reopen saved simulated outlines and proposals and require correction of an invalid answer before applying.
- Knowledge checks, matching, sequencing, flashcards and decision scenarios use native controls and server-side grading. Client-provided marks are ignored. Required activities prevent final-assessment access until completion, and passing evidence reaches progress and the facilitator queue.
- Learner responses survive refresh. The activity editor supports ordinary fields, adding and removing items, moving blocks and items, reusable templates, working learner previews and undo. Both the activity editor and learner practice fit a 390-pixel phone viewport without page overflow.
- Existing human marking, moderation permissions, final-assessment unlock, discussion, reminders, support, receipts and certificate review workflows still pass. A downloaded test certificate is a single landscape PDF with its crest, signatures and QR code.

## Practical limits

These are local acceptance results, not a report of a live deployment. Live AI-provider generation, live payments, outbound email, Docker execution and the user's Render environment were not exercised. Three existing storage tests were skipped because the required operating-system capabilities were unavailable. The existing lint warnings are recorded rather than hidden.

H5P, LTI and SCORM are not implemented. Decision scenarios in this release are editable decision questions with feedback, not branching paths. Source support verifies exact excerpts; it does not provide page references, video timestamps or automatic claim verification. Generation has saved outline and lesson stages, but full-course lesson development is still one provider request; use lesson requests for large manuals. Usage costs are estimates from configured rates, not invoices.

See `FACILITATOR-STUDIO-v13.1.0.md` for deployment steps and the staging checks to run with the institution's configured provider.
