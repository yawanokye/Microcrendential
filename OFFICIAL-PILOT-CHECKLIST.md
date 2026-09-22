# UCC Growth+ official pilot checklist

Complete every item before inviting learners.

## Controlled release mode

- Deploy Render with `PLATFORM_MODE=demonstration`, `DEMONSTRATION_MODE_LOCK=true` and `EMERGENCY_DEMONSTRATION_MODE=false`.
- Use Demonstration mode for presentations and acceptance testing, and enter test records only.
- Confirm the amber Demonstration banner is visible and that no new official certificate can be issued.
- When every readiness item in the administrator panel is green, use **Activate Official Pilot**.
- Remove `DEMONSTRATION_MODE_LOCK` only after the UCC domain and Resend sending domain have been verified.
- Sign in again after activation and confirm learner verification codes and staff MFA arrive successfully.

## Institutional approval

- Confirm the approved public name is **UCC Growth+**.
- Approve the pilot course, facilitator, learning outcomes, assessment and award type.
- Approve the privacy notice, terms, accessibility statement, identity retention period and incident contacts.
- Upload the approved Provost and facilitator signatures.
- Record the certificate approval reference in Course Studio.

## Domain and communication

- Point an approved UCC subdomain to Render and enable HTTPS.
- Set `NEXT_PUBLIC_APP_URL` to the final HTTPS address before issuing any certificate.
- During Render demonstrations, set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY` and `EMAIL_FROM=UCC Growth+ <onboarding@resend.dev>`.
- Before Official Pilot activation, verify the approved UCC sending domain in Resend, replace `EMAIL_FROM` with that domain and test delivery to external learner and staff addresses.
- Test learner email verification, staff security codes, password reset and facilitator invitation delivery.

## Data and recovery

- Confirm the persistent disk is attached at `/var/data`.
- Confirm `/api/health/live` returns `200`.
- Confirm `/api/health` returns `200 ready` after the first backup.
- Run `npm run backup`, then `npm run backup:verify`.
- Download the latest archive from the administrator backup endpoint and place it in approved encrypted off-platform storage.
- Record who may access identity evidence and backups.

## Course and certificate acceptance

- Activate one approved non-demo pilot course.
- Test free enrolment with a new learner account using a non-UCC email.
- Complete every required lesson and assessment.
- Issue and download each certificate configuration intended for the pilot.
- Confirm crest, partner logo, signatures and QR remain visible in the saved landscape certificate.
- Scan the QR on a phone, then test revocation and restoration.

## Release control

- Push the repository to GitHub.
- Protect `main` and require the `UCC Growth+ pilot quality gate` workflow.
- Keep Render automatic production deployment off.
- Deploy to staging first, complete acceptance testing, then manually promote the approved commit.
- Record the deployed commit, date, operator and rollback point.

## Pilot limits

- Keep `PILOT_MAX_LEARNERS=50` unless the pilot committee approves a different number.
- Keep `PAYMENTS_ENABLED=false` until UCC Finance completes live Paystack and refund acceptance testing.
- Confirm Demonstration-only testing content disappears after Official Pilot activation.
- Review support cases, backup status, disk use and security events each working day.
