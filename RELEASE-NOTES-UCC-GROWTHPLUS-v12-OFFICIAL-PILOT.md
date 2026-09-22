# UCC Growth+ v12.1.1 Render Demonstration Release

Release date: 22 September 2026

## v12.1.1 Render and Resend correction

- Keeps the public application address on `https://ucc-microcredential-platform.onrender.com` while UCC DNS approval is pending.
- Selects Resend as the deployment email provider and uses its test sender for restricted demonstrations.
- Keeps the platform in Demonstration mode, with official credential issuance disabled and Official Pilot activation blocked by the UCC-domain readiness check.
- Retains secure manual facilitator invitation links when Resend cannot deliver to an external test recipient.

## v12.1.0 controlled platform mode

- Adds an administrator-controlled switch between **Demonstration** and **Official Pilot** modes.
- Keeps Render safely in Demonstration mode while UCC completes DNS, email, signatures, backup and support readiness.
- Shows a platform-wide Demonstration banner, enables sample learning content and bypasses learner email verification and staff MFA for controlled demonstrations.
- Prevents all new official certificate and stacked-credential issuance while Demonstration mode is active; previously issued credentials remain available and verifiable.
- Allows Official Pilot activation only after every administrator readiness check passes.
- Invalidates existing sessions when Official Pilot is activated so every user signs in again under pilot security controls.
- Provides an emergency Render setting that can restore Demonstration mode if a pilot dependency such as email delivery becomes unavailable.

## v12.0.2 Google Mail support

- Adds Google Mail and Google Workspace delivery for verification, MFA, invitation and password-reset messages.
- Uses a dedicated mailbox and Google app password stored only in Render environment settings.
- Retains Resend as an optional alternative provider.

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
- Automated tests: 35 passed, 0 failed
- ESLint: 0 errors, 31 non-blocking legacy warnings
- Next.js production build: passed, 73 application pages generated
- Docker-style production context build without the test directory: passed
- Standalone runtime smoke test: platform mode and liveness routes returned HTTP 200 with Demonstration safeguards active
- Backup creation and restore-integrity check: passed

## Required institutional setup before launch

1. Approve the official hostname and point DNS to the production service.
2. Set a unique `AUTH_SECRET` and the authorised initial administrator email.
3. Verify the approved UCC sending domain in Resend, then replace the demonstration sender and test authentication and invitation delivery to external addresses.
4. Set and monitor `SUPPORT_EMAIL`.
5. Connect `MONITORING_WEBHOOK_URL` to an approved incident channel.
6. Upload approved Provost and facilitator signatures and confirm the UCC and partner branding for every issuing option.
7. Approve at least one pilot course, complete an end-to-end learner journey and verify its public credential URL and QR code.
8. Download an encrypted backup to an approved off-platform location and complete one documented restore drill.
9. Complete accessibility, privacy, records-retention and incident-response sign-off with the responsible UCC offices.
10. Keep `PAYMENTS_ENABLED=false` during the pilot unless Finance approves live collection and the payment webhook is tested.

Use `OFFICIAL-PILOT-CHECKLIST.md` for launch approval and `PILOT-OPERATIONS-RUNBOOK.md` for routine operation and incident handling.
