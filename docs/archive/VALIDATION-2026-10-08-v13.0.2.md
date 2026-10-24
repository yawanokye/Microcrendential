# Validation - UCC Growth+ v13.0.2

Validated on 8 October 2026 with Node v24.19.0 and Next.js 16.3.8. Docker and a Node 22 runtime were not available for execution; the Dockerfile and GitHub workflow retain Node 22.

| Check | Result |
| --- | --- |
| Page layout prebuild check | Passed for the correct layout. Isolated fixtures confirmed rejection of a learner page copied over the landing page, a facilitator import of the landing route and a missing learner page. |
| Production build | Passed with `npm run build`, including the new prebuild check and standalone output. |
| Application and test type checking | Passed with `npm run typecheck`. |
| ESLint | Passed with 0 errors and 44 existing warnings. |
| Production API acceptance | All 46 checks passed against the actual standalone server with an isolated database. |
| Platform route regression | `/` and `/facilitator-studio` render the platform entry point independently of the learner route, without redirects. |
| Learner route regression | Course URLs, lesson URLs and query-string learning URLs resolve the expected course and lesson parameters. |
| Certificate regression | Direct download, course-code filename, one landscape page and embedded crest, signatures and QR verified. |

The current acceptance check list is included in `validation/api-results.json`. The unit/integration results in the v13.0.0 note remain historical and were not rerun for this page repair. The production HTTP suite covers the relevant routes and existing authenticated delivery workflows.

Interactive browser automation was not completed because Chromium was unavailable. No external email was sent, no payment was taken, and no live GitHub or Render change was made. The reported build log establishes the mismatched page/component contract; the current remote repository could not be read during this session.

Apply all files in the focused repair together, at their exact paths, or use the complete source ZIP. See `BUILD-REPAIR-v13.0.2.md`.
