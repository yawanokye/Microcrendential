# Render TypeScript build fix — 2026-09-20 R2

This revision is based directly on the user-supplied `Microcrendential-master (7).zip`.

## Build blocker corrected

`src/app/api/courses/route.ts` no longer declares a manually assembled `LearnerPresentedCourse` with an `Omit<...> & { activities: ... }` contract. The learner-safe course shape is now inferred from `learnerVisibleCourse()` itself, and `catalogueOnly()` accepts `ReturnType<typeof learnerVisibleCourse>`.

The mapper also removes the internal `activities` array before constructing the learner-safe activity array, so the returned object cannot carry the internal and learner activity types at the same time.

This makes the learner DTO resilient when `StructuredLearningActivity` gains or changes fields and removes the type mismatch occurring in the Render `next build` type-check phase.

## Build hygiene

`tsconfig.tsbuildinfo` was removed from the archive and `*.tsbuildinfo` was added to `.gitignore`; it is generated incremental compiler cache data and should be recreated by the build environment.

## Validation in this environment

- 162 TypeScript/TSX files transpiled with 0 syntax diagnostics.
- The learner mapper/catalogue type pattern passed an isolated strict TypeScript semantic check.
- A full `npm ci` / `next build` could not be completed here because registry access failed with `EAI_AGAIN`; Render remains the dependency-backed build authority.
