# UCC Growth+ v12.2.2, Render storage repair

## Resolve the reported backup permission error

The app successfully started, but the non-root backup process could not create a snapshot under `/var/data/backups`. The previous Dockerfile changed ownership during image construction. Render attaches the persistent disk afterwards, so that change did not repair existing mounted files.

The new Docker entrypoint prepares the mounted application storage, repairs the database, uploads and backup ownership, and then permanently drops to `nextjs`, UID/GID 1001. The web server and maintenance jobs run without root privileges. It does not delete existing records, uploads, signatures or backups.

1. Update the repository with this release, including `Dockerfile`, `scripts/pilot-entrypoint.mjs`, `scripts/pilot-backup.mjs` and `scripts/pilot-server.mjs`.
2. Keep the existing Render persistent disk mounted at `/var/data`.
3. Keep the variables below. Do not change `AUTH_SECRET` as part of this repair.
4. Leave Render's custom Docker Command blank to use the image's entrypoint and command. Do not override the Docker entrypoint.
5. Redeploy the service. Confirm `storage.ready` reports UID/GID 1001 before the Next.js startup message.
6. About one minute after startup, confirm that the backup job reports `status: completed` and `integrity: ok`.
7. While signed in as an administrator, confirm `/api/admin/backups` lists a new completed archive and `/api/admin/pilot-readiness` no longer reports a missing completed backup. Other readiness checks still apply.

```env
DATA_DIR=/var/data
SQLITE_PATH=/var/data/ucc-microcredentials.sqlite
BACKUP_DIR=/var/data/backups
AUTO_BACKUP_ENABLED=true
BACKUP_INTERVAL_HOURS=24
BACKUP_RETENTION_DAYS=14

PLATFORM_MODE=demonstration
DEMONSTRATION_MODE_LOCK=true
DEMONSTRATION_FULL_FUNCTIONALITY=true
EMERGENCY_DEMONSTRATION_MODE=false
PILOT_REQUIRE_OFFICIAL_DOMAIN=false
PUBLIC_REGISTRATION_ENABLED=true
EMAIL_VERIFICATION_REQUIRED=true
STAFF_MFA_REQUIRED=true
```

Continue using the same Google OAuth email settings from v12.2.1:

```env
EMAIL_PROVIDER=google_oauth
GMAIL_USER=your-authorised-google-mailbox
EMAIL_FROM=UCC Growth+ <your-authorised-google-mailbox>
GOOGLE_OAUTH_CLIENT_ID=your-client-id
GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret
GOOGLE_OAUTH_REFRESH_TOKEN=your-refresh-token
```

The current Google OAuth sender uses Gmail SMTP. A paid Render web-service instance is required because Render Free blocks SMTP ports. The included Blueprint targets Starter with a persistent disk. Preserve the current email credentials.

## Backup and retention behaviour

Snapshot-folder creation is now inside the backup error-handling boundary. Permission errors are recorded as failed backup runs when the database can still be written. Temporary snapshot directories use unique names and are cleaned up after the job. A backup is successful only after the SQLite integrity check returns `ok`.

If a scheduled backup fails, scheduled identity retention is skipped. The main web server continues running. If storage cannot be prepared at startup, the entrypoint stops with `storage.initialization_failed` so the problem is visible before the app accepts traffic.

The Node SQLite experimental warning is informational. It is separate from filesystem permission errors and is not suppressed by this release.
