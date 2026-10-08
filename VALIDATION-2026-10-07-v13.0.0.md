# Validation - UCC Growth+ v13.0.0

Validated on 7 October 2026 using Node v24.19.0 and the pinned Next.js 16.3.8 dependency. The Dockerfile and GitHub workflow retain Node 22. Docker and a Node 22 runtime were not available for execution in this workspace.

| Check | Result |
| --- | --- |
| Dependency installation | Passed with `npm ci`. |
| Type checking | Passed for application and test configurations. |
| ESLint | Passed with 0 errors and 44 warnings, principally existing image, hook-dependency and unused-variable warnings. |
| Unit/integration tests | 64 tests: 61 passed, 3 skipped, 0 failed. |
| Production build | Passed with `next build --webpack`; standalone output produced. |
| Authenticated production API acceptance | 41 checks passed against the actual standalone server and an isolated database. |
| Certificate structural checks | Direct download, course-code filename, one landscape page and embedded image objects verified. Identical fixture signatures share an embedded image object. |
| Certificate visual review | Latest test PDF rendered through Poppler and inspected. Crest, both test signature placements, course details and verification QR were visible and readable. |
| Browser automation | Not completed. Chromium was unavailable and its download failed in this environment. A reproducible optional browser script is included. |
| External email and payments | No external email sent and no payment taken. Live Google OAuth, AI and payment-provider acceptance remains required. |

## Evidence covered by automated checks

- Grade reductions remove a stale aggregate pass while retaining other valid passing attempts.
- Approved course snapshots survive later curriculum changes.
- Teaching, marking, moderation and team-management permissions remain distinct.
- Attendance and participation awards use attendance requirements, and future attendance cannot satisfy them.
- Invalid credential evidence opens a deduplicated review; durable grading and assisted-score approval operate independently of the original request.
- Lesson progress and resume state share the same saved record.
- Monthly usage deduplicates learners and excludes staff and test records; notifications are deduplicated.
- Intake capacity is enforced atomically, and failed transactions roll back.
- Existing password, request-origin, certificate policy, AI proposal, backup and retention tests pass.
- Authenticated HTTP tests verify liveness, protected maintenance, answer-key exclusion, saved drafts, HTTPS-only notebook links, concurrent notebook protection, course-specific virtual evidence, pending evidence protection, assigned marker decisions, final submission receipts, required-learning progress, certificate issuance/download, discussion access, preferences, support replies, payment receipts, refund requests, cohorts, separate intakes, paged course retrieval and grade-to-credential review.

The three skipped tests need CHOWN, SETUID and SETGID capabilities: mounted-storage privilege dropping, nested-symlink ownership protection and a backup under the repaired unprivileged account. The available storage-validation, verified-archive and failed-backup retention tests passed.

## Reproduction and deployment status

Run the commands in `COMMERCIAL-DELIVERY-RUNBOOK.md`. The API suite seeds only an isolated temporary database, disables external email settings and creates clearly labelled test signatories. It does not modify live records. Its check list is included in `validation/api-results.json`.

The source is ready for the documented acceptance deployment. This session did not push a GitHub commit, deploy to Render, run a real payment/refund, certify accessibility or complete a concurrent-user load test. The runbook identifies these remaining acceptance activities without treating the local checks as institutional acceptance.
