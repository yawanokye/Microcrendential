# Render TypeScript hotfix — learning activity submissions

The Render build failed around `src/app/api/learning-activity-submissions/route.ts` because the inline-activity `.filter()` used a custom TypeScript type predicate that was not assignable to the `StructuredLearningActivity` element type returned by `ensureStructuredLearningActivities()`.

The route now keeps the canonical `StructuredLearningActivity` type and filters inline activities with a normal boolean predicate. This preserves all structured fields while avoiding an invalid narrowing contract.

Validation: targeted `tsc --noEmit` produced no diagnostics for this route. Full dependency-backed Next.js build must run in Render because this extracted environment does not include project `node_modules`.
