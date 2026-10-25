# v13.3.2 optional practical activity selection

Facilitators now start the Practical tools stage with **No practical activity** selected. A visible **Skip practical activities** button continues directly to assessment. Selecting Colab or a virtual practical opens its editor. Selecting **No additional practical activity** keeps existing saved practicals. Required lesson activities remain in Build Content and retain their completion rules.

No database migration or provider configuration is needed. This release builds on the verified working v13.3.1 package and retains its source-layout deployment repair, optional corporate controls and AI/H5P/LTI capabilities. Dependencies are unchanged.

## Validation

Checked on 24 October 2026 using Node 22.23.4 and the production webpack build.

| Check | Result |
| --- | --- |
| Application and test TypeScript checks | Passed |
| Production build and standalone preparation | Passed |
| ESLint | 0 errors, 42 existing warnings |
| Unit suite | 99 passed, 3 skipped, 0 failed |
| Studio and native interactive learner browser checks | 14 passed |
| New optional practical browser/API checks | 7 passed |
| Desktop and phone visual review | Passed |

The new acceptance script covers both practical editors, returning to no practical activity, skip navigation, saving and reopening, academic submission with zero separate practicals, retention of five required native lesson activities, retention of an existing virtual practical, phone overflow and browser errors. Run it with `npm run test:practicals` after a production build, with Playwright and Chromium installed. It uses an isolated synthetic database and removes AI/email provider configuration.

The three skipped unit tests require process ownership capabilities unavailable in this environment. Earlier v13.3.1 acceptance results are retained as historical records. They were not all rerun for this small interface change. No live AI call, external H5P tool or Render deployment was performed. Screenshots are internal QA material and excluded from the release.

## Update the existing GitHub repository

Replace the extracted files at the existing repository root. Preserve the `src` folder structure. This release changes `src/components/platform-home.tsx`, `src/app/programme-activities.css`, the package version, documentation and the acceptance script. It does not require changes to stored course data or environment variables.

Check that `package.json` shows **13.3.2**, commit the update, then deploy the existing Render service using its current configuration. The historical `maintenance/github-cleanup-v13.3.1.patch` is for the older GitHub snapshot. Do not apply that historical cleanup patch to an already working v13.3.1 or v13.3.2 checkout.
