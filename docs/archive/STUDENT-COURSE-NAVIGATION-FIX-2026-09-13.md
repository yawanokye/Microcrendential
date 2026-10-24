# Student course navigation fix

This release changes the active-course experience from a long, blocking list into a focused section-by-section learner flow.

## Learner-facing changes

- The course window is wider, height-bounded, and independently scrollable.
- A sticky navigation bar remains visible while the learner reads.
- **Exit course** returns the learner to **My microcredentials**.
- **Previous** and **Next** arrows move between course sections.
- A **Go to section** menu provides direct section access.
- **Start learning**, **Continue section**, and **Review section** open the correct lesson for the learner's current state.
- Only the selected section is displayed, avoiding a single very long course page.
- Completed lessons and completed sections have visible status indicators.
- Completing a lesson updates saved progress and opens the next lesson, including when it belongs to the next section.
- Course objectives and outcomes remain available in a compact expandable overview.
- Mobile layouts keep the navigation controls visible and usable.

## Files changed

- `src/app/page.tsx`
- `src/app/commercial-course-studio.css`

## Verification completed

- `npm run build`
- `npm test -- --runInBand`
- `npm run lint` (no errors; existing warnings remain)

Deploy the complete package through the existing Render-connected repository. No database migration or new environment variable is required for this change.
