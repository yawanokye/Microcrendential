# Render Acceptance Deployment, UCC Growth+ v12.2.1

## Required Render variables

Set these values on the existing Render web service:

```text
PLATFORM_MODE=demonstration
DEMONSTRATION_MODE_LOCK=true
DEMONSTRATION_FULL_FUNCTIONALITY=true
EMERGENCY_DEMONSTRATION_MODE=false
PILOT_REQUIRE_OFFICIAL_DOMAIN=false
NEXT_PUBLIC_APP_URL=https://ucc-microcredential-platform.onrender.com
EMAIL_PROVIDER=google_oauth
GMAIL_USER=your-google-sending-mailbox
EMAIL_FROM=UCC Growth+ <the-same-google-sending-mailbox>
GOOGLE_OAUTH_CLIENT_ID=your-oauth-client-id
GOOGLE_OAUTH_CLIENT_SECRET=your-oauth-client-secret
GOOGLE_OAUTH_REFRESH_TOKEN=your-offline-refresh-token
EMAIL_VERIFICATION_REQUIRED=true
STAFF_MFA_REQUIRED=true
PUBLIC_REGISTRATION_ENABLED=true
```

Keep `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REFRESH_TOKEN`, `AUTH_SECRET`, `INITIAL_ADMIN_EMAIL` and `SUPPORT_EMAIL` as secret or manually managed values.

## Google OAuth setup

1. Enable the Gmail API in the Google Cloud project used for the sending mailbox.
2. Configure the OAuth consent screen and create an OAuth client.
3. Authorise the sending mailbox with offline access and obtain a refresh token with Gmail sending permission.
4. Store the client ID, client secret and refresh token only in Render environment variables.
5. Set `GMAIL_USER` to the authorised mailbox. Set `EMAIL_FROM` to the same address or an alias that the account is permitted to send as.
6. Redeploy and test learner verification, staff sign-in, invitations and password recovery with different external addresses.

Google OAuth does not depend on the UCC website DNS. UCC can continue acceptance on the Render address while ICT prepares the final platform domain.

## Acceptance checks after redeployment

1. Confirm the banner says **Acceptance environment** and reports full functionality.
2. Register a learner and complete the six-digit email verification.
3. Invite a facilitator and complete facilitator setup and staff security-code sign-in.
4. Test password recovery.
5. Upload the Provost and facilitator signatures.
6. Activate an approved course, complete its requirements and issue the credential.
7. Download the certificate directly. Confirm the filename is the course code and the crest, signatures and QR are visible.
8. Scan the QR and confirm that the public register returns the active credential.
9. Revoke and restore a test credential and confirm the public status changes.

Do not enable `EMERGENCY_DEMONSTRATION_MODE` during acceptance. That switch is reserved for an authentication, email or credential-service incident.
