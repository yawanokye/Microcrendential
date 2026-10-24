# Validation, UCC Growth+ v12.2.2

## Results

- Automated tests: 49 discovered, 46 passed, 0 failed, 3 capability-dependent tests skipped.
- TypeScript application and test checks: passed.
- ESLint: 0 errors, 31 existing warnings in unrelated components.
- Next.js production build: passed, 73 generated pages/routes in the build progress report.
- Startup, maintenance and backup JavaScript syntax checks: passed.
- Backup archive creation and verification: passed, checksum matched and SQLite integrity returned `ok`.

## Reproduced failure

An unwritable backup directory produced `EACCES`. The updated script returned a failure status, recorded a failed `backup_runs` row, and did not report a successful backup. A separate scheduler test confirmed that failed backup jobs skip scheduled identity retention while the web-server process remains running.

Startup was tested with ownership and identity spies to verify scoped ownership repair, supplementary-group removal, the GID/UID switch to 1001 before server launch, and preservation of an external symlink target. System-root and out-of-data backup paths were rejected. Writable storage produced a verified database-and-upload archive containing the expected learner and certificate records.

## Runtime verification limit

The local environment runs Node.js 24.19.0 with only UID/GID 0 mapped and no CHOWN, SETUID or SETGID capabilities. Docker is not available here. Three real operating-system ownership/drop-privilege tests therefore could not run in this workspace. They are included and run on a Linux host with the required capabilities. The deployment image targets Node.js 22.

This package has not been deployed to the user's live Render service. After redeployment, confirm `storage.ready` reports UID/GID 1001 and the first backup reports `completed` with `integrity: ok`. Retain the existing persistent disk and authentication secrets.
