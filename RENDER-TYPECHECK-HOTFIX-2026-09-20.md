# Render TypeScript hotfix — 20 September 2026

## Cause
The learner-safe course mapper returned a reduced activity object but its TypeScript alias still inherited the full `StructuredLearningActivity[]` type. Render therefore stopped during `next build --webpack` in `src/app/api/courses/route.ts` before the new UI/workflow changes could deploy.

## Fix
- Added an explicit `LearnerActivity` safe type.
- Excluded the internal `activities` field from the inherited learner course type and replaced it with `LearnerActivity[]`.
- Preserved learner-visible activity instructions, response type, response-entry mode, pass mark, attempts, grading mode, section/material linkage and prompt-image presentation metadata.
- Continued to withhold internal rubric/correct-answer data from the learner course payload.

## Deployment consequence
Because the previous Render build failed, the live site continued serving the earlier successful deployment. The professional lesson reader, response controls, course hydration, unpublish workflow and approved crest path were present in source but did not reach production.
