# Commercial delivery setup and acceptance

## Upgrade the existing Render service

1. Take a verified backup and rehearse this release against a private copy of the current database and uploads.
2. Copy all files inside the extracted release folder into the existing GitHub repository root. Include every new `src/lib`, API, component, style, script and test file, plus `package.json`, its lockfile, Dockerfile and workflow. Do not upload only selected files.
3. Run the GitHub quality gate. It includes production build and isolated authenticated API acceptance tests on Node 22.
4. Deploy the approved commit to the existing Render service and keep its existing persistent disk attached at `/var/data`. Preserve `AUTH_SECRET`, mail credentials, database path, stored uploads and signatories.
5. Keep Render's custom Docker command blank. The Docker entrypoint must repair mounted ownership and drop privileges before the server starts. Keep the liveness health-check path `/api/health/live`.
6. Confirm `storage.ready`, liveness, detailed `/api/health` diagnostics, sign-in, an enrolled course and the next verified backup. The new migrations run automatically and are additive.

Acceptance hosting remains fully functional with these settings:

```env
PLATFORM_MODE=demonstration
DEMONSTRATION_MODE_LOCK=true
DEMONSTRATION_FULL_FUNCTIONALITY=true
EMERGENCY_DEMONSTRATION_MODE=false
PILOT_REQUIRE_OFFICIAL_DOMAIN=false
NEXT_PUBLIC_ENABLE_DEMO_CONTENT=false
DATA_DIR=/var/data
SQLITE_PATH=/var/data/ucc-microcredentials.sqlite
BACKUP_DIR=/var/data/backups
```

Keep the configured Google OAuth sender variables from the previous release. No institutional email or UCC domain is required for learner registration. `PAYMENTS_ENABLED` remains an explicit payment activation control; enable it only with configured provider credentials and the intended test/live environment. Fee collection does not depend on the hosting domain.

## Configure a course for delivery

In Course Studio, define the award type and partnership/issuer options, select approved branding and signatories, and set the delivery requirements. These settings form part of the academically approved course version.

| Decision | Setting and behaviour |
| --- | --- |
| Identity timing | Before award by default, or before learning for a course that requires it. |
| Final marking | Automatic, human, or AI-assisted draft followed by marker approval. |
| Deadlines and feedback | Course assessment deadline and feedback target; individual activity deadlines remain available. |
| Additional practicals | Select the Colab or virtual activities that must pass for the award. Required lesson activities are evaluated independently. |
| Participation award | Set an attendance percentage and record attendance after sessions. Use 0% for a genuinely asynchronous award whose requirements are the approved learning activities. |
| Fees and refunds | Publish course/certificate fees and course-specific refund terms before enrolment. |

Existing enrolments are pinned once to the approved version present during migration. Subsequent approved revisions apply to future enrolments. A separate intake copies the approved curriculum under a new offering code; dates and capacity are independent, while curriculum changes still follow academic approval. Review copied deadlines, branding and partner authorisation before opening another intake.

Course owners and administrators assign active facilitator accounts as co-facilitators, markers or moderators. A moderator handles discussions and appeals; changing a grade requires marking permission and a separately recorded decision.

Legacy virtual-practical records that have no course code are preserved. They are not guessed into a new intake or used automatically as course-specific award evidence. Review these records through the existing authorised records workflow and obtain replacement course-specific evidence where required.

## Operate learner delivery

The learner can start with a basic profile and save optional biodata later. Passwords, identity numbers and identity images are excluded from registration drafts. Identity evidence is still submitted and reviewed through the protected identity process.

Use the teaching priorities and gradebook to manage pending submissions, overdue feedback, engagement, appeals and practical evidence. Grade corrections include a reason and decision history. When corrected evidence invalidates an issued credential, the registry shows `under_review`. An administrator must restore it only after the requirements are valid, or revoke it with a recorded reason.

Support tickets retain replies and status. The displayed target is two working days; agree staffing and response expectations for acceptance. Live meetings and recordings use authorised external URLs. The platform schedules and records these sessions; the meeting provider hosts the session itself.

Refund requests record a UCC decision. Finance processes an approved refund through the payment provider and records its reference when marking the request completed. This release does not automatically transfer refund money. Requests outside the published window can still be submitted for UCC review; a request is not an approval.

## Reconcile UCC payments to Anovlad

In the administrator usage area, set the agreed contract definition and GHS rate before freezing a month:

- `engaged`: distinct non-test learners with a saved lesson, assessment or evidence event in the UTC month.
- `enrolled`: distinct non-test learners with active or completed enrolments created by month-end, according to the records when frozen.

One learner enrolled across several courses counts once. Staff and explicitly marked test accounts are excluded. Export the reconciliation and freeze it only after review. Frozen reports preserve their original count, definition and rate; later activity or price changes do not rewrite them. The report supports invoicing but does not issue a statutory invoice, charge UCC automatically or replace the signed UCC-Anovlad agreement. Learner course fees remain separate UCC payment records.

## Background processing and monitoring

The Docker supervisor calls authenticated delivery maintenance once per minute, with an initial 15-second delay. It uses `AUTH_SECRET` to authenticate locally. It processes saved grading jobs, 48-hour assessment reminders, 15-minute live-session reminders, optional Monday digests and opted-in notification emails. Automatic grading retries before leaving saved evidence for a marker. Manual marking cancels outstanding jobs so a delayed automatic result cannot overwrite the decision.

If running `next start` outside the Docker supervisor, schedule the authenticated `/api/internal/delivery` call yourself. Do not expose the worker token publicly. Continue using the existing backup and retention operations runbook.

This remains a single-institution, single-instance SQLite deployment with a persistent disk. It is not a multi-tenant or horizontally scaled SaaS deployment. Additional institutions, database scaling and load targets require a separately designed deployment.

## Reproduce checks

```bash
npm ci
npm run lint
npm test
npm run typecheck
npm run build
npm run test:api
```

`test:api` launches the built production standalone server against isolated temporary storage and fake `.example.test` accounts. It does not send external email, take payments or seed the live database. Keep its generated certificate labelled as test evidence.

Optional browser acceptance needs Playwright and Chromium:

```bash
npm install --no-save --package-lock=false playwright
npx playwright install chromium
npm run test:browser
```

## Acceptance before official promotion

- Complete phone, tablet, keyboard, screen-reader, focus, contrast and reduced-motion checks. Responsive styles and labels are implemented; accessibility conformance is not certified.
- Use authorised participants to test registration, code resend, Google email delivery, staff sign-in, recovery and identity review in the deployed environment.
- Complete a course with each intended marking mode, a participation award, partner branding and signatories, an appeal and a grade/attendance correction. Check preview, direct PDF, printing and public verification.
- Test configured AI failure/recovery with an approved provider. Confirm saved evidence reaches the marking queue.
- Test payment success, cancellation, repeated webhook/callback, receipt access and refund processing in the payment provider's test environment before live activation.
- Review the UCC-Anovlad billable-user definition, rate, test-account labels, frozen export and Finance reconciliation.
- Rehearse backup restoration, inspect disk growth, and load-test the expected concurrent learner count.

The release has not been deployed by this implementation session. Promote it only after the relevant acceptance checks and authorised operational decisions are complete.
