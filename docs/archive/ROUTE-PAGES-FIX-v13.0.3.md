# UCC Growth+ v13.0.3 - source page and component repair

The current error is in `src/app/page.tsx`: a component is receiving `courseCode` and `lessonId` even though its uploaded definition accepts neither. The landing page must render `PlatformHome` without course props. Course and lesson props belong in the separate `src/app/learn/page.tsx`, whose matching `LearningPage` component accepts them explicitly.

The earlier two-package-file fix removed the missing prebuild helper dependency. It did not replace incorrectly uploaded application source files. Keep those v13.0.3 package files and apply this source repair too.

## Immediate correction of the reported file

In GitHub, open **src > app > page.tsx**, edit that existing file and replace its entire contents with:

```tsx
import PlatformHome from "@/components/platform-home";

export default function HomePage() {
  return <PlatformHome />;
}
```

This is the landing page. The course page code is a different file, at `src/app/learn/page.tsx`.

## Apply all matching source files

Extract the focused repair ZIP. From the repository root, upload its `src` folder and `next.config.mjs`, keeping the folder structure. Confirm these exact destinations before committing:

| Destination | Purpose |
| --- | --- |
| `src/app/page.tsx` | Landing page importing `@/components/platform-home`. |
| `src/app/facilitator-studio/page.tsx` | Facilitator entry importing `@/components/platform-home` directly. |
| `src/app/learn/page.tsx` | Course entry passing course and lesson values to `LearningPage`. |
| `src/components/learning-page.tsx` | Learning component with explicit `LearningPageProps`. |
| `src/components/platform-home.tsx` | Matching platform component with lesson resume support. |
| `next.config.mjs` | Internal rewrites preserving existing learner course and lesson links. |

The three files named `page.tsx` have different destinations. Keep each in its own directory. Upload the folder tree from the repository root rather than copying each page into `src/app`.

If your GitHub browser upload still fails, use the editor for **each exact destination**: edit an existing file or create a file using its full path, then copy the corresponding extracted file's contents. Start with `src/app/page.tsx`, which is the file named in the current error. Commit the complete matching source set together.

If the obsolete `src/app/learn/[courseCode]/[[...lesson]]/page.tsx` exists, remove it. Keep the plain `src/app/learn/page.tsx` from this release. Redeploy the commit containing the corrected source files.

This focused ZIP contains six application/configuration files and instructions. It is an update for the existing v13 application, not a complete repository. The package version remains v13.0.3, and no prebuild helper is required. The complete source ZIP includes the same files and the existing commercial implementation.

Local validation covers the matched source files. The live GitHub repository and Render deployment were not edited in this session.
