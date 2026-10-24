# Course Studio and learner experience refinement — 2026-09-20

This update is based on `UCC-Microcredential-Structured-Activities-Broader-Import-2026-09-19.zip` and preserves the structured-learning-activity, broader-credential, scanned-document import, Luna/Terra grading, governance and certificate changes already present in that build.

## 1. Existing courses open directly into the six-stage Studio

- The **Available Created Courses** panel is open by default.
- The whole course card is clickable and keyboard accessible.
- Selecting a course loads the saved design, materials, learning activities and assessment into the six-stage Course Studio starting at Stage 1.
- Active courses continue to use the controlled-revision workflow.

## 2. Learning activities live only in Build Content

- Inline/lesson learning activities remain attached to a specific learning block in **Stage 3 — Build Content**.
- Only these inline learning activities can be marked **Required for section completion**.
- Section completion now counts required inline learning activities only.
- Stage 4 no longer displays inline learning activities.

## 3. Colab and Virtual Lab are optional practical tools

- Stage 4 is renamed **Practical tools** and is explicitly optional.
- Only Colab and Virtual Lab items appear in this stage.
- New practical tools are always stored as optional (`required: false`).
- Older saved Colab/Virtual Lab records are normalised to optional whenever a course is opened and again before it is saved.
- Practical tools do not block lesson/section completion or the course award.

## 4. Learner lesson content and activity response are visible together

- Learner section cards show a content excerpt when text is available.
- A visible badge indicates when a lesson contains a learning activity and how the learner is expected to respond.
- Opening the lesson displays the complete learner-facing HTML/text/media and the attached activity in the same lesson dialog.
- A required activity must be passed and feedback recorded before the learner can complete that lesson/section.

## 5. Per-activity response-entry control

For text-based learning activities, the facilitator can select:

- **Type or paste**
- **Type only — paste blocked**
- **Paste only — direct typing blocked**

The selected mode is carried through the learner-safe course API and applied to the learner response box.

## 6. Assessment text-response control

Assessment questions now have the same response-entry options. The setting is retained with each question and exposed in the learner-safe assessment configuration.

## 7. UCC visual identity

Course Studio and learner-course elements use the UCC institutional palette:

- UCC blue: `#2e3094`
- UCC red: `#ed1b24`
- UCC yellow: `#fdf003`

The colours are used for Studio headers, active stages, course cards, section headings, activity panels, learner-course headers and assessment/response states while preserving accessibility and readable contrast.

## Modified application files

- `src/app/page.tsx`
- `src/app/api/courses/route.ts`
- `src/lib/assessment-policy.ts`
- `src/app/commercial-course-studio.css`

## Validation performed

- TypeScript/TSX syntax transpilation across `src` and `tests`: **152 files, 0 syntax errors**.
- Static integration assertions passed for clickable course cards, inline-only section gating, optional practical separation, learner content/activity visibility, per-activity response mode, per-assessment response mode, learner-safe API fields and UCC brand colours.
- A full dependency-backed `next build` was not run in this working container because the extracted source does not contain `node_modules`.
