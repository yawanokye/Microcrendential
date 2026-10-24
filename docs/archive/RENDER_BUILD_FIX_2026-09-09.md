# Render build fix — 9 September 2026

The deployment failed because `src/lib/manual-course-import.ts` constructed a `CourseDesign` without the newly required `certificateFeeGhs` property.

This release:

- adds `certificateFeeGhs: 0` to imported course designs;
- fixes imported courses to `enrolmentMode: "open"`;
- defaults imported course enrolment fees to `priceGhs: 0`;
- retains the facilitator's ability to enable enrolment or certificate fees later in Course Studio.

Verification completed:

- `npm run build` — passed with Next.js 16.2.6;
- TypeScript — passed;
- all 48 application routes were generated;
- `npm run lint` — zero errors (existing non-blocking warnings remain).

Upload the complete contents of this release to the GitHub repository root and allow Render to auto-deploy the resulting commit.
