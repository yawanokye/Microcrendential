# Rich authoring, assessment approval and learner completion update — 2026-09-19

## Facilitator learner-content editor
- Added a simple rich-text toolbar to the **Editable learner text** editor: Bold, Italic, H2, list, hyperlink and image insertion.
- Facilitators can upload a picture/drawing/chart or insert an HTTPS image address.
- Added an optional supporting-video URL to each learning block.
- Facilitator chooses whether the supporting video plays **inside the learner content frame** or **opens in a separate browser tab**.
- Existing Watch materials also retain their in-frame/new-tab display option.
- Rich content is still passed through the existing HTML sanitisation before storage/publication.

## Question-bank review and approval gate
- New and edited questions begin as **Preview required** and are excluded from the learner assessment.
- Previewing changes the question to **Previewed · approval required**.
- The preview dialog shows the learner-facing question and available answer key/model answer/marking scheme.
- **Approve for assessment** explicitly admits the question to the learner assessment.
- Approved questions change to a green visual state in the question bank.
- Editing an approved question resets approval so the changed version must be previewed and approved again.
- Legacy active questions without the new state fields remain compatible and are treated as approved.
- Publication validation requires at least one approved question where an assessment is configured.

## Learner presentation
- Section notes/descriptions are now shown clearly inside the lesson reader under **About this section**.
- Internal AI provenance labels such as `AI-assisted draft · OpenAI` are hidden from learners while remaining visible to facilitators during authoring/review.
- Learner lesson cards also suppress internal AI provider labels.
- Text content falls back to stored plain text if readable HTML is unavailable.
- Supporting videos respect the facilitator-selected in-frame/new-tab mode.

## Assessment unlocking
- Completing the lesson that makes all required learning 100% complete now immediately opens the assessment when approved questions are available.
- A clear **assessment ready** banner/button remains available if the learner returns to the course screen.
- If no question has been previewed/approved, the assessment stays unavailable and the facilitator sees the approval state in the question bank.

## Persistent completion and certificate protection
- Required lesson completion remains persistent via the existing monotonic learning-progress update (`MAX(completed, excluded.completed)`).
- Section completion is calculated from required lessons, so optional resources do not undo a completed section.
- Completed lessons open in review mode with **Close lesson**, not another completion action.
- A learner who has already passed the course assessment cannot submit another assessment for the same course.
- Failed learners may retry within the configured attempt allowance without redoing completed sections.
- Existing certificate uniqueness remains enforced at database level; certificate issuance uses the existing idempotent insert so one learner/course cannot receive repeated certificate records.
- Learner assessment status now also checks the canonical `assessment_attempts` pass record, not only submission history.

## Modified application files
- `src/app/page.tsx`
- `src/app/commercial-course-studio.css`
- `src/lib/course-design.ts`
- `src/lib/assessment-policy.ts`
- `src/app/api/content/ingest/route.ts`
- `src/app/api/courses/route.ts`
- `src/app/api/courses/revisions/route.ts`
- `src/app/api/assessments/route.ts`

No database schema migration is required for this update.

## Validation performed
- TypeScript/TSX syntax-transpilation check across all 141 files under `src`: **0 syntax diagnostics**.
- Assessment-policy assertions verified that unapproved questions are excluded, approval is required for publication, and legacy questions remain compatible.
- Static checks confirmed persistent learning completion, passed-assessment blocking, canonical prior-pass lookup and idempotent certificate issuance remain present.
- A full `next build` was not run in this environment because the extracted archive does not contain `node_modules`; Render/GitHub CI should perform the dependency-backed production type check/build.
