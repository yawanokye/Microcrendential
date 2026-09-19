# Facilitator flexibility and learner-reading update — 19 September 2026

This release builds on the policy-aligned/typecheck-fixed platform and improves the Course Studio for non-technical facilitators.

## Learner reading experience
- `Complete and continue` is no longer sticky/floating over the learning content.
- The completion/progress action now follows the learning content and appears at the bottom of the lesson dialog.
- Mobile layout keeps the completion button full-width below the learner-progress message.

## Content building
- Every learning block in each course section now has **Preview**, **Edit** and **Remove** actions.
- Preview opens the same learner-facing content renderer used by the course experience.
- Edit supports title, section placement, source, estimated time, rights/licence note, rendered rich lesson text, resource/video URL, transcript and accessibility confirmation.
- AI-assisted and manually created content use the same editable review workflow.
- Added **Jump to a section to revise** plus **Preview whole course as learner**.

## Question bank
- Every authored question now has **Preview**, **Edit** and **Remove** actions.
- Question Preview shows the prompt, options, correct answer/matching key and marking scheme.
- **Accept & load into editor** auto-fills the question editor with the question and answer configuration.
- Existing questions can be revised and saved in place rather than duplicated.
- Added a clear edit-state banner and cancel-edit control.

## Navigation
- Added explicit **Previous** and **Next stage** controls.
- Added a **Jump to any stage** selector.
- Existing roadmap navigation remains available, so facilitators can move backward or directly to any stage without losing draft data.
- Content sections can be opened directly using the section selector.

## Modified application files
- `src/app/page.tsx`
- `src/app/commercial-course-studio.css`

## Validation
- TypeScript/TSX syntax transpilation was run over all 141 `.ts`/`.tsx` source files: **0 syntax errors**.
- Static checks confirmed the learner completion placement, content preview/edit, question preview/accept/edit, previous-stage navigation and section jump controls.
- A full Next.js build was not completed in this execution environment because `npm ci` stalled while fetching dependencies; no build-success claim is made here.
