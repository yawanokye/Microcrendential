# Render build fix — manual course importer compatibility

## Resolved failure

Render failed because `src/app/api/course-import/manual/route.ts` imported
`buildManualCourseProposal`, while `src/lib/manual-course-import.ts` exported
nothing. GitHub's browser uploader overwrites matching files but does not delete
older tracked files that are absent from an uploaded folder.

## Fix included

- Restored the `buildManualCourseProposal` runtime export.
- Restored the `ManualCourseProposal`, `ManualImportGroup` and
  `ManualImportStatus` type exports used by the retained importer component.
- Includes all current `CourseDesign` properties, including
  `certificateFeeGhs` and `creditValue`.
- Keeps courses free and open for self-enrolment by default.
- Keeps the original manual attached and creates section-by-section readable
  learning blocks.
- Keeps generated content as an unsaved, review-required proposal.
- Adds same-origin mutation protection and an audit event to the compatibility
  endpoint.
- Keeps the newer `/api/course-design/from-manual` endpoint unchanged.

## Validation completed

- `npm run build`: passed with Next.js 16.2.6.
- `npm test`: 7 tests passed.
- `npm run lint`: 0 errors; 13 pre-existing warnings.

## Upload note

Extract the ZIP and upload the contents at the GitHub repository root. Ensure
these three paths are overwritten:

1. `src/lib/manual-course-import.ts`
2. `src/app/api/course-import/manual/route.ts`
3. `src/components/manual-course-importer.tsx`

Uploading only the newly added files will leave the incompatible tracked files
unchanged and reproduce the Render error.
