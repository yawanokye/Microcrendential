# UCC Growth+ v13.0.2 - page upload repair

The reported build log shows the learner route's required `searchParams` type in `src/app/page.tsx`. The landing page must render `PlatformHome` without these props. The second error also shows that the uploaded learning component does not accept `courseCode` and `lessonId`. The reported build is still labelled v13.0.0, so it does not contain the complete v13.0.1 upload fix.

This repair restores all three route entry points together with their matching components and rewrite configuration. The facilitator route now imports `PlatformHome` directly from the component, rather than importing the landing route. `npm run build` first checks that the page files are in the expected locations and reports exact paths if they are mixed up.

## Apply the focused repair

The focused repair ZIP contains only the related files. The complete source ZIP contains the same repair and the full commercial implementation. Choose one ZIP to apply.

1. Extract the ZIP. Open the extracted directory that contains `package.json`, `next.config.mjs`, `src` and `scripts`.
2. Open the **root** of the existing GitHub repository. The breadcrumb must show `Microcrendential`, without `src` or `app` after it.
3. Use **Add file > Upload files**. Drag the extracted **src** and **scripts** folders, together with `package.json`, `package-lock.json` and `next.config.mjs`, into the upload area. Preserve the directories. Do not drag all three `page.tsx` files individually into `src/app`.
4. Confirm these exact destinations before committing:

| File | Required destination |
| --- | --- |
| Landing page | `src/app/page.tsx` |
| Facilitator page | `src/app/facilitator-studio/page.tsx` |
| Learner course page | `src/app/learn/page.tsx` |
| Learning component | `src/components/learning-page.tsx` |
| Platform component | `src/components/platform-home.tsx` |
| Page layout check | `scripts/check-route-layout.mjs` |
| API acceptance checks | `scripts/test-commercial-api.mjs` |
| Internal learner rewrites | `next.config.mjs` |
| Package version and scripts | `package.json` |
| Dependency lock | `package-lock.json` |

5. If `src/app/learn/[courseCode]/[[...lesson]]/page.tsx` still exists, remove that obsolete file. Keep `src/app/learn/page.tsx`.
6. Commit the related changes together. Render should show `ucc-microcredentials@13.0.2` and the successful page layout check before compiling. If it still shows v13.0.0, it is building the older package or a different branch.
7. Redeploy the new commit. No environment-variable or database change is required for this repair.

The landing page and facilitator studio are separate from the course/lesson route. Existing `/learn/COURSE-CODE` and `/learn/COURSE-CODE/LESSON-ID` links remain supported.

The focused ZIP is an update for the existing v13 source. It is not a complete application and must not replace unrelated repository files. The ZIP itself is a download container. Extract it before uploading its contents to GitHub.

This session validates the repaired source locally. The live repository and Render deployment were not edited.
