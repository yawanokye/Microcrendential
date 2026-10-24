# Professional Course Studio & Learner UX correction — 20 September 2026

This build corrects the facilitator and learner issues reported from the deployed Course Studio screenshots.

## Course Studio
- Clicking any saved course now hydrates the title, identity, blueprint, outcomes, content, practical tools, assessment and review data into the same six-stage editor immediately.
- An active course loads as the current published version first; editing is locked until the facilitator explicitly chooses either **Controlled revision** or **Unpublish for revision**.
- **Unpublish for revision** is available both on the saved-course card and in the current-course command bar. It takes the programme offline, returns it to draft and clears the old activation/pre-authorisation record while preserving historical learner certificates.
- Unpublishing a component used by an active broader credential is blocked until the broader pathway is handled, so an active pathway cannot silently point to an unpublished component.

## Learning activities and learner responses
- Legacy lesson blocks that contain a clear `Activity` / `Learning Activity` heading are automatically bridged into a structured inline learning activity when no explicit activity record exists.
- This gives the learner a real response field/upload/link control, pass mark, attempts, automatic marking and feedback instead of showing only the activity instructions.
- Explicit structured activities remain authoritative and are not duplicated.
- Required activity completion continues to require both a passing result and recorded feedback.

## Lesson and activity images
- Facilitators can select an image inside the rich lesson editor and move it up/down, align it left/centre/right/full-row and resize it small/medium/large/full-width.
- These safe media placement classes are retained by the HTML sanitizer and rendered in the learner lesson.
- A structured learning activity can also have its own uploaded picture/drawing/chart with configurable placement, size and accessibility alternative text.

## Learner presentation
- The lesson dialog now uses a professional reading layout with a centred publication-style page, stronger heading hierarchy, improved paragraph spacing, UCC-branded section note, separate graded-activity card, clearer response fields and feedback, and a bottom completion action that does not cover the lesson text.
- Facilitator Course Studio text and controls have higher contrast; the UCC blue/red/yellow palette no longer produces white-on-white navigation controls.

## Certificate crest
- The exact crest supplied on 20 September 2026 is copied to both `public/ucc_crest.png` and the certificate reference assets.
- Production now references the cache-busting unique path `public/ucc_crest_approved_2026.png`.
- The production and certificate-template copies are byte-for-byte identical to the supplied crest.

## Validation
- All TypeScript/TSX files were syntax-transpiled with the global TypeScript compiler: 149 files, 0 syntax diagnostics.
- Legacy embedded Activity -> structured learner response bridge smoke test passed.
- Static integration checks passed for course hydration, controlled revision/unpublish controls, learner response/grade UI, lesson image placement, activity image placement and the unique approved crest path.
- The approved crest checksum was verified identical across supplied and deployed copies.
- A full `next build` was not run in this extracted environment because `node_modules` is not present; Render will run dependency installation before the production build.
