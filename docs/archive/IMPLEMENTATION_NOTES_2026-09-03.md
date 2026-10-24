# UCC Microcredentials portal reorganisation

Implemented on 2026-09-03.

## Public landing and access
- Unauthenticated users now see an edX-style public discovery landing page rather than a role-selection wall.
- Public page includes UCC Microcredentials promotion, approved active course cards, objectives/outcomes, search, Register, Login, credential verification, and staff access.
- Added `/fsadmin` as the public facilitator/system administration gateway. Authentication and role permissions remain enforced after entry.
- Added `/api/courses/public` as a read-only endpoint exposing only active approved course summaries.

## Facilitator Course Studio
- Retained the six-step authoring workflow but made the assessment stage more explicit and comprehensive.
- Added a persistent **Preview as student** action using the current studio state.
- Preview supports course navigation and a safe assessment test mode without writing learner results or issuing certificates.
- Facilitator portfolio now displays administrator review comments and change requests.

## Assessment redesign
- Expanded modes to include objective quiz, video watch + answer, pause checks, short answer, essay/reflection, practical assignment, viva/oral defence, and authentic evidence.
- Expanded question types with scenario response, oral-defence prompt and evidence-upload prompt.
- Added an Assessment Integrity panel recommending layered evidence approaches rather than claiming any online assessment is fully AI-proof.
- Existing video question settings continue to support whole-video, selected-segment and pause-and-answer modes.

## Admin approval workflow
- Review comments are now stored with each course version.
- Returning a course requires a written comment.
- Facilitators see those comments in their course portfolio.
- Approval button is labelled **Approve & publish**. Approved courses become `active`, which makes them visible to learners and in the public catalogue.
- When a returned course is resubmitted for review, the previous return comment is cleared so the new review is unambiguous.

## Database additions
`course_drafts` now includes:
- `review_comment`
- `reviewed_by_email`
- `reviewed_at`

The runtime migration helper adds these columns to existing SQLite databases automatically.

## Validation note
A full Next.js build could not be executed in the supplied archive environment because dependencies were not bundled and dependency installation did not complete within the execution environment. Source-level changes were inspected after modification; run `npm ci && npm run build` in the deployment/GitHub environment before release.
