# Moodle-style Course Studio and learner reading release

## What changed

### Facilitator Course Studio

- Added a persistent **Course administration** menu modelled on Moodle's left-hand course navigation.
- Kept the six authoring stages visible with live completion and remaining-check indicators.
- Added quick links for **My courses**, **AI & import tools**, **Preview as student**, and **Save draft**.
- Collapsed AI, manual-import, and tutorial utilities into a focused **Course creation tools** disclosure so the current editing task remains prominent.
- Retained the right-hand quality-assurance panel for immediate readiness feedback.
- Added responsive two-column and single-column layouts for tablets and phones.

### AI assessment approval

- AI review now lists every proposed assessment question separately.
- Facilitators can select or clear individual questions and expand each one to inspect its model answer, marking guidance, feedback, marks, and outcome mapping.
- Facilitators choose whether approved questions replace or append to the current Question Bank.
- **Approve and import** opens the Assessment stage and shows a clear verification checklist.
- Every Question Bank item now has **Edit & approve**, which loads it into the actual question editor. Saving updates the existing question instead of creating a duplicate.
- The same explicit Question Bank destination is used for Gemini-generated media questions.

### Student reading experience

- Removed the internal scrolling area from converted learning documents.
- Moved **Complete and continue** to a normal end-of-lesson panel after the final paragraph.
- Improved typography, heading hierarchy, lists, quotations, code, and responsive tables.
- Plain-text and PDF extraction now recognises module, unit, chapter, section, topic, part, numbered, and uppercase headings.
- Manual imports add a section heading when the extracted block does not already contain one.
- The original uploaded document remains available while learners use the organised HTML reading version.

## Verification completed

- `npm test`: 16 tests passed.
- `npm run lint`: completed with no errors (existing non-blocking warnings remain).
- `npm run build`: Next.js production build and TypeScript validation completed successfully.

## Deployment

Upload the contents of the release archive at the GitHub repository root, preserving the folder structure. Do not upload the containing archive folder as an additional directory. Render can then auto-deploy from the updated branch.
