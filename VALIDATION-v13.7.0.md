# Library validation — 26 October 2026

Node 22.23.4: application and test TypeScript checks passed. Unit suite: 153 passed, 3 existing capability skips, zero failures. Clean production build passed. ESLint: zero errors, 72 existing warnings across the full GitHub checkout, including historical root copies. No warnings in new library files.

Eight isolated production API/browser acceptance checks passed: anonymous page/API protection, cross-site mutation rejection, private bookmarks, role permissions, course reading access, search disable control, all three portal links, public homepage exclusion and mobile layout with no browser errors. Screenshots were reviewed privately and are excluded from the repository.

Unit checks cover blocked URL schemes, OA result filtering, bookmark isolation, private-course audience revocation, facilitator permissions, source caching and institution request limits. A real unauthenticated OpenAlex query returned HTTP 200 with two OA results. Automated acceptance uses synthetic records and makes no external provider or payment calls.
