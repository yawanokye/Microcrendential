# Guided manual learning and controlled course revisions

This release implements the requested student reading journey and facilitator revision workflow.

## Student portal

- Every enrolled course opens as a complete course portal with Course home, Learning manual, Activities, Assessment, and Progress & award views.
- Imported manuals retain their original uploaded file. For PDFs, learners can expand the original layout inside the course or open the source file in a new browser tab.
- The manual is also converted into safe, rich HTML sections with headings, paragraphs, lists, tables, links, quotations, and other supported formatting preserved.
- Sections are presented one at a time. A learner completes the current section before the next section unlocks.
- **Mark complete & continue** stores the learner's completion record and advances to the next section.
- The course progress bar updates immediately and restores the saved position on the learner's next visit.
- Certificate eligibility now includes completion of all published learning-manual sections, in addition to the existing assessment and required-activity checks.

## Facilitator portal

- Active courses now include an **Edit active course** action.
- Selecting it copies the full approved course into an isolated revision workspace, including identity, design, sections, content, activities, assessments, accessibility, and certificate settings.
- Saving a revision never changes the learner-facing course.
- **Apply revision for approval** forwards the edited version to the administrator while the currently approved version remains active for students.
- Submitted revisions are locked until an administrator approves or returns them.

## Administrator approval

- Course approvals now include pending course revisions as well as new courses.
- Approving a revision atomically replaces the active course content and increments its version number.
- Returning a revision requires an explanatory comment.
- Version-conflict protection prevents an older revision from overwriting a newer active course.

## Data additions

- `course_content_progress` stores learner completion by course and material.
- `course_revisions` stores isolated draft, submitted, rejected, and approved versions.
- Migration: `database/migrations/0015_course_progress_and_revisions.sql`.

## Verification

- Production build passes with Next.js.
- Lint passes with no errors.
- The API workflow was exercised locally: create revision, save, submit, approve, publish version 2, record one of two manual sections complete, and restore 50% progress.
