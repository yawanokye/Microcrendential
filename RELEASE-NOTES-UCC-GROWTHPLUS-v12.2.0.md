# UCC Growth+ v12.2.0 Render Acceptance Release

## Full functionality on Render

- Separates the pre-production environment label from the platform capability policy.
- Enables learner email verification, staff security codes, password recovery, completion processing, approved certificate issuance and stacked credentials when `DEMONSTRATION_FULL_FUNCTIONALITY=true`.
- Replaces the former restriction banner with an Acceptance environment notice that accurately reports whether full functionality or emergency restricted operation is active.
- Keeps `EMERGENCY_DEMONSTRATION_MODE=true` as the deployment-level incident control that pauses code-dependent authentication and new credential issuance.
- Allows the HTTPS Render address to satisfy acceptance readiness when `PILOT_REQUIRE_OFFICIAL_DOMAIN=false`; production promotion can restore the UCC-domain requirement.

## Deployment and security

- Updates Next.js and its ESLint configuration from 16.3.5 to 16.3.8 to address the reviewed security advisory.
- Runs the production container as an unprivileged application user with write access limited to the application and persistent data directories.
- Keeps manual deployment promotion and payment processing disabled by default.
- Retains academic approval, verified identity, assessment, payment and signature gates for credential issuance.

## Certificate delivery

- Adds direct certificate download without opening the preview or using the browser print dialogue.
- Generates an A4 landscape PDF on the server and uses the course code as the filename.
- Embeds the UCC crest, approved partner logo, stored signatures, credential details and verification QR in the PDF so they remain visible after download.
- Embeds licensed document fonts for consistent, readable output across devices.

## Google OAuth email delivery

- Selects `google_oauth` as the Render email provider.
- Supports Gmail or Google Workspace OAuth 2.0 through the authorised mailbox, client ID, client secret and refresh token.
- Sends learner verification, staff security codes, invitations and password recovery directly to each account without requiring UCC DNS.
- Keeps the Gmail app-password and Resend implementations only as optional compatibility providers.
