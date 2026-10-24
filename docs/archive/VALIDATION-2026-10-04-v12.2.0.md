# UCC Growth+ v12.2.0 Validation Record

Validated on 4 October 2026 for the Render acceptance deployment.

## Completed checks

- ESLint completed with 0 errors. Existing non-blocking warnings remain recorded for later refactoring.
- 39 automated tests passed, including capability separation, acceptance email routing, certificate filename safety and server PDF generation.
- Application and test TypeScript projects completed with no type errors.
- Next.js 16.3.8 production build completed successfully.
- The build generated 73 application routes, including `/api/certificates/download`.
- Production dependency audit reported 0 vulnerabilities.
- The generated certificate was rendered and visually checked as a single A4 landscape page.
- The downloaded certificate embeds licensed fonts, the UCC crest and the verification QR. Stored partner marks and signature snapshots are embedded when present.
- The production Docker image is configured to run as an unprivileged application user.

## Acceptance profile

The Render deployment remains labelled as an Acceptance environment. With `DEMONSTRATION_FULL_FUNCTIONALITY=true`, email verification, staff security codes, password recovery, approved completion processing and credential issuance are active. `EMERGENCY_DEMONSTRATION_MODE=true` remains the explicit incident switch that pauses code-dependent authentication and new credential issuance.

The optional `ACCEPTANCE_EMAIL_REDIRECT_TO` setting supports multi-account acceptance through the Resend test sender while UCC DNS is pending. It must be removed when a verified sending domain becomes available.
