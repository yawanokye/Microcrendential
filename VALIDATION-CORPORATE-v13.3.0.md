# UCC Growth+ v13.3.0 validation

Validation date: 24 October 2026. Runtime: Node 22.23.4. Production tests use an independent clean installation, an isolated SQLite database and synthetic accounts. No customer database was modified.

## Build and code checks

| Check | Result |
| --- | --- |
| Fresh `npm ci` in a separate project directory | Passed, 550 packages installed from the lockfile |
| Node 22 production build with webpack | Passed, standalone server, public assets, static assets and maintenance scripts prepared |
| Production start launcher | Passed, healthy `/api/health/live` and working authenticated APIs/UI |
| Type checking, application and tests | Passed |
| ESLint | Zero errors, 42 existing warnings |
| Unit tests | 95 tests, 92 passed, 3 skipped, zero failures |

The three storage tests require CHOWN, SETUID and SETGID capabilities unavailable in this workspace. They are reported as skipped, not successful. The Docker mounted-disk ownership repair was retained but could not be exercised here. The production build bounds worker concurrency at two.

## Production acceptance

The text logs and structured results under `validation/corporate-assurance` record the individual assertions. The corporate suite uses the new production launcher and synthetic camera input in headless Chromium. Browser checks include 390-pixel mobile screens and keyboard/select alternatives for matching.

| Suite | Passed checks |
| --- | ---: |
| Existing commercial API and PDF credential/receipt checks | 46 |
| Native interactive activity API | 23 |
| Existing learner and facilitator browser journey | 14 |
| Course Studio and five native interactive activity browser checks | 14 |
| Live AI diagnostic controls and mock LTI integration | 25 |
| Optional corporate assurance API and browser journey | 33 |
| Total | 155 |

The corporate checks cover independently disabled defaults, identity/roster authorisation, one active browser, private answer snapshots, stable randomisation, matching choices, server deadlines and additive extensions, saved answers, prompted camera capture and stopped streams, evidence privacy, workplace submission, correct grading, credential withholding, individual competency thresholds, stale review rejection, oral meeting details, protected employer CSV export, mobile layout, the master switch enabling no child control, and ordinary courses making no corporate API/camera request.

They also cover later negative review of an issued credential, refusal of premature restoration even by an administrator, a released browser resuming the same evidence follow-up and quiz grade, an authorised supervised camera alternative, administrator-controlled restoration after all requirements pass, evidence download expiry, streamed upload size limits, and absence of browser page errors.

Unit tests additionally check atomic session consumption, cancelled-attempt accounting and deletion of expired file bytes while preserving the audit record.

## What remains external

- The previous deployment failure has no available log. The corrected native startup/package path was tested locally. A deployment to the user's Render service was not performed.
- Docker and Podman are unavailable here. No Docker image build or actual Render persistent-disk permission repair is claimed.
- No live AI provider generation was run using customer credentials. The diagnostic and credential-required failure states were tested. Configure the provider, then run the administrator's live verification or the documented live verification command.
- LTI 1.3/OIDC, signing keys, content selection and grade-return behavior were tested against a mock tool. No actual H5P.com account or customer tool deployment was connected.
- Webcam input was synthetic. The implementation collects prompted evidence for human review. It does not claim facial recognition, guaranteed liveness or proof against all impersonation and outside assistance.
- Real email delivery, payments and live meeting services were not contacted.
- Browser screenshots are internal QA material and are excluded from this release package. The package includes source, tests, setup guides and text/JSON validation evidence.

All new corporate controls remain optional and off by default. Existing institution-wide identity and award requirements remain governed by their existing settings.
