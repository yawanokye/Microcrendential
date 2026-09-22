# UCC Growth+ pilot operations runbook

## Demonstration and Official Pilot modes

Keep the Render service in **Demonstration** mode with `DEMONSTRATION_MODE_LOCK=true` while DNS, email, signatures, backups and course approval are being completed. The lock prevents an older database selection from restoring Pilot authentication on the Render address. After ICT completes DNS and Resend is verified, remove the lock, review every prerequisite and activate **Official Pilot** from the Users & Access area. Activation closes all existing sessions; administrators, facilitators and learners must sign in again under the pilot authentication rules.

Demonstration mode must use test records only. It bypasses email-code challenges and prevents all new official certificate and stacked-credential issuance. Previously issued credentials remain visible and verifiable.

If a pilot dependency fails, an administrator may return to Demonstration mode in the portal. If sign-in itself is unavailable, set `EMERGENCY_DEMONSTRATION_MODE=true` in Render and redeploy. After recovery, set the portal mode to Demonstration, restore the dependency, set the emergency variable back to `false`, redeploy, complete the readiness checks and reactivate Official Pilot.

## Daily checks

1. Open `/api/health/live` and confirm the service and database are available.
2. Sign in as administrator and open `/api/admin/pilot-readiness` in the same browser session.
3. Check support requests, identity-review queues, failed sign-ins, course status and certificate activity.
4. Confirm the latest backup is less than 36 hours old.
5. Watch disk use under `/var/data`, including uploads and backups.

## Backups

The production wrapper creates a consistent SQLite and upload archive every 24 hours. Fourteen days are retained by default.

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
