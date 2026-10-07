# UCC Growth+ v12.2.2

Fixes the Render backup error `EACCES: permission denied, mkdir '/var/data/backups/.../snapshot'`.

- Repairs application-storage ownership after the persistent disk is mounted, before the web server starts.
- Runs the server and maintenance jobs as UID/GID 1001 after permanently dropping root privileges.
- Checks write access to the data, upload, backup and database directories before accepting traffic.
- Rejects system-root storage paths and does not follow nested symlinks during ownership repair.
- Records snapshot-creation permission errors as failed backup runs when the database is writable.
- Uses unique temporary snapshot folders and requires an `ok` SQLite integrity result.
- Skips scheduled identity retention after failed backups.
- Preserves the v12.2.1 acceptance capabilities, Google OAuth settings, certificate behaviour and existing stored records.

Deploy with the existing Render disk. No database reset, new OAuth token or change to the full-functionality settings is required for this permission fix.
