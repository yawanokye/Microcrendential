# UCC Growth+ pilot operations runbook

## Demonstration and Official Pilot modes

Keep the Render service in the **Acceptance environment** with `DEMONSTRATION_MODE_LOCK=true` and `DEMONSTRATION_FULL_FUNCTIONALITY=true` while institutional DNS is being completed. The lock preserves the pre-production label, while Google OAuth enables authentication codes, password recovery, approved completion processing and credential issuance for acceptance testing. After ICT completes the approved UCC address and confirms the production Google or Google Workspace sending mailbox, remove the label lock, set `PILOT_REQUIRE_OFFICIAL_DOMAIN=true`, review every prerequisite and activate **Official Pilot** from the Users & Access area. Activation closes all existing sessions.

Acceptance records and credentials are live records. Use authorised acceptance participants, approved courses and signatories, and revoke any credential created only for a scripted test before production promotion.

If an authentication, email or credential dependency fails, set `EMERGENCY_DEMONSTRATION_MODE=true` in Render and redeploy. This pauses authentication-code-dependent operations and new credential issuance. Restore the dependency, return the variable to `false`, redeploy and complete a focused acceptance check before resuming.

## Daily checks

1. Open `/api/health/live` and confirm the service and database are available.
2. Sign in as administrator and open `/api/admin/pilot-readiness` in the same browser session.
3. Check support requests, identity-review queues, failed sign-ins, course status and certificate activity.
4. Confirm the latest backup is less than 36 hours old.
5. Watch disk use under `/var/data`, including uploads and backups.

## Backups

The production wrapper creates a consistent SQLite and upload archive every 24 hours. Fourteen days are retained by default.

The Docker entrypoint repairs storage ownership after Render mounts the persistent disk and then starts the server as `nextjs`, UID/GID 1001. Keep the existing disk attached and look for `storage.ready` on startup. Do not bypass `scripts/pilot-entrypoint.mjs` or replace the disk to resolve a permission error. Backup failures are recorded when the database is writable. Scheduled identity retention is skipped until a backup completes successfully.

Run a manual backup from the Render shell:

```bash
npm run backup
```

Verify the newest archive:

```bash
npm run backup:verify
```

An administrator can list backups at `/api/admin/backups` and download one with `/api/admin/backups?file=FILENAME`. Copy at least one verified backup each day to approved encrypted storage outside the Render disk. A backup on the same disk is not a complete disaster-recovery copy.

## Restore rehearsal

1. Create a private staging service with no public registration and no live payment key.
2. Verify the chosen archive with `npm run backup:verify /path/to/archive.tar.gz`.
3. Stop the staging service.
4. Extract the database and uploads into the staging data directory.
5. Start staging and test sign-in, one course, one identity record, one certificate and QR verification.
6. Record the restoration date, archive checksum, operator and result.

Never overwrite the production database during a rehearsal.

## Account incident

1. Suspend the affected profile and preserve the audit record.
2. Reset the password and revoke any exposed invitation or security code.
3. Rotate `AUTH_SECRET` only when all sessions must be invalidated.
4. Assess whether identity, learning, payment or certificate data was exposed.
5. Escalate under the approved UCC incident and data-breach procedure.

## Failed deployment

1. Do not delete the persistent disk.
2. Redeploy the last approved GitHub commit.
3. Check `/api/health/live`, then `/api/health`.
4. If the database fails, preserve the current files before any restore.
5. Restore only from a verified archive and record the action.
6. If the application runs but authentication email is unavailable, use the emergency Demonstration procedure above; do not disable MFA while leaving Official Pilot mode active.

## Payment activation

Keep `PAYMENTS_ENABLED=false` throughout the initial pilot. Before changing it to `true`, test Paystack live/test key separation, the production webhook, receipts, duplicate callbacks, failed transactions, reconciliation and refunds. Obtain UCC Finance approval and publish the course-specific fee and refund terms.
