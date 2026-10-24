# Render TypeScript Fix — 18 September 2026

## Build failure fixed
Render failed at `src/app/api/courses/route.ts` because the learner-safe object retained the property `certificatePreapproved` with the value `undefined`, while `catalogueOnly()` required the full presented course type where `certificatePreapproved` is a required boolean.

## Correction
- Added `PresentedCourse` and `LearnerPresentedCourse` types.
- Added `learnerVisibleCourse()` to actually omit private governance fields from learner responses rather than setting them to `undefined`.
- Changed `catalogueOnly()` to accept the learner-safe course type.
- Updated the learner GET response to use `learnerVisibleCourse(course)`.

This keeps committee approval data and certificate pre-authorisation data out of learner-facing responses while preserving the strict internal course type.

## Validation
A local TypeScript run no longer reports an error for `src/app/api/courses/route.ts`.
A complete Next.js build cannot be run in the current execution environment because project dependencies are not installed and registry access is unavailable. Render, which installs dependencies during Docker build, should proceed beyond the previously reported type error.
