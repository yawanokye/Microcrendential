# Render SQLite course revision migration — 2026-09-20

## Runtime error fixed

`ERR_SQLITE_ERROR: no such column: revision_number` from `/api/courses/revisions`.

## Cause

Older deployments created `course_revisions` with the legacy columns `base_version_number`, `payload_json`, and `version_number`, and a status constraint that allowed `approved`. The current revisions API expects `revision_number`, `snapshot_json`, and current statuses including `applied`.

`CREATE TABLE IF NOT EXISTS` cannot transform an existing SQLite table, and simply adding `revision_number` would leave the old status CHECK constraint in place.

## Fix

`src/db/raw.ts` now detects the legacy table shape at database startup and performs a one-time in-place migration:

- preserves existing revision rows and IDs;
- assigns a stable per-course `revision_number`;
- maps `payload_json` to `snapshot_json`;
- maps legacy `approved` to current `applied`;
- preserves review timestamps/comments and approval timestamps;
- creates the current approval-record columns and indexes;
- records migration key `0016_course_revisions_canonical_schema`.

The SQL reference migration `database/migrations/0015_course_progress_and_revisions.sql` was aligned with the current schema as well.

## Validation

A legacy SQLite database was created with the previous `course_revisions` schema and two existing revisions. Starting the current database layer migrated it successfully, preserved both rows, converted the approved row to `applied`, exposed the new columns, recorded migration `0016_course_revisions_canonical_schema`, and accepted a new `applied` revision under the current CHECK constraint.
