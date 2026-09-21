# UCC Growth+ v12.0.1 Official Pilot

Release date: 21 September 2026

## v12.0.1 deployment correction

- Separates production application type checking from test-suite type checking.
- Removes test files from the Docker production build context while retaining them for CI and local validation.
- Makes the Docker build verify that the password and upload-security source modules are present before compiling.

## Pilot-ready improvements

- Accepts any valid personal or professional learner email. A UCC email address is not required.
- Requires email verification for learner registration and email-based multi-factor authentication for staff when enabled.
- Adds secure password recovery, stronger password hashing, session invalidation and cross-site request protection.
- Supports facilitator invitations from any institution with a recorded professional affiliation.
- Adds operational readiness and liveness endpoints, privacy-minimised error monitoring, audit events and administrator-only backup downloads.
- Adds scheduled database and upload backups, checksum verification and identity-evidence retention controls.
- Validates uploaded identity, branding and certificate files by their actual file signatures.
- Keeps payment collection disabled for the official pilot unless UCC explicitly enables and configures it.
- Adds privacy, terms, accessibility, refund and support pages with a stored support-request reference.
- Preserves the approved UCC Growth+ brand, landscape certificates, signatures, click-to-expand certificate details and direct certificate download.
- Stores downloaded certificates using the course code as the filename.
- Adds separate official-pilot and staging Render blueprints with manual production promotion.
- Adds GitHub quality checks and dependency-update configuration.

## Verification completed

- TypeScript type check: passed
- Automated tests: 31 passed, 0 failed
- ESLint: 0 errors, 30 non-blocking legacy warnings
- Next.js production build: passed, 73 application pages generated
- Docker-style production context build without the test directory: passed
- Standalone runtime smoke test: liveness, privacy, password recovery and robots routes returned HTTP 200
- Backup creation and restore-integrity check: passed

## Required institutional setup before launch

1. Approve the official hostname and point DNS to the production service.
2. Set a unique `AUTH_SECRET` and the authorised initial administrator email.
3. Verify the UCC sender domain with the transactional email provider, then set `RESEND_API_KEY` and `EMAIL_FROM`.
4. Set and monitor `SUPPORT_EMAIL`.
5. Connect `MONITORING_WEBHOOK_URL` to an approved incident channel.
6. Upload approved Provost and facilitator signatures and confirm the UCC and partner branding for every issuing option.
7. Approve at least one pilot course, complete an end-to-end learner journey and verify its public credential URL and QR code.
8. Download an encrypted backup to an approved off-platform location and complete one documented restore drill.
9. Complete accessibility, privacy, records-retention and incident-response sign-off with the responsible UCC offices.
10. Keep `PAYMENTS_ENABLED=false` during the pilot unless Finance approves live collection and the payment webhook is tested.

Use `OFFICIAL-PILOT-CHECKLIST.md` for launch approval and `PILOT-OPERATIONS-RUNBOOK.md` for routine operation and incident handling.
