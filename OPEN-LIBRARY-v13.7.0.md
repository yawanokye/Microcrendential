# Signed-in Open Access Library — v13.7.0

All three portals have an Open Access Library navigation link. `/library` requires an active account and redirects anonymous visitors to sign-in. `/api/library` independently authenticates every request. No homepage or public Learn menu link was added.

Learners search OpenAlex by keyword and selected area, with publication-year and document-type filters. Results must be flagged open access and have an HTTPS reading link. The page shows source, available author/year information and licence, and opens the document at its source. Search results are not institutionally approved readings. Bookshelves are private per account, and plain-text citations use available metadata.

Facilitators and administrators can add search results or specific open document links to courses they teach. Learners see those reading lists only while the existing course-access and organisation-audience checks permit access. Removing organisation eligibility removes private reading-list access. Bookmarks contain the public source record only, without private course labels or guidance.

Administrators can disable external searches while retaining saved resources and course reading lists. Search requests share a 24-hour cache. Defaults are 80 uncached external requests per institution per UTC day, with 20 per account. Limits can be changed from Library administration. Failed provider attempts also consume a request. These are request limits, not guaranteed currency spending limits.

## Provider configuration

`OPENALEX_API_KEY` is optional for basic provider access and recommended for production volume. Set it in the server environment. Never expose keys to the browser or commit them. No paid subscription is created by this update. Provider quota failures show a retry message without losing saved readings. Each search returns up to 20 results, and selecting an area adds it to the keyword query.

The initial release integrates OpenAlex live search. UCC repository, OpenStax, DOAB/OAPEN and other open documents can be selected manually through their specific HTTPS document links. Automatic harvesting of these sources, Unpaywall enrichment, AI summaries and PDF hosting are not included in this release.

The additive SQLite migration creates library bookmarks, course readings, cache, request counters and settings on the existing persistent disk. No new infrastructure or dependency is required.

## Verification

Run Node 22: `npm test`, `npm run typecheck`, `npm run build` and `npm run test:library`. Browser acceptance uses synthetic records and disables external calls. Set `CODEX_PRIMARY_RUNTIME_NODE_MODULES` and `TEST_CHROMIUM_EXECUTABLE` for a separately installed Playwright and Chromium. A separate live OpenAlex request returned HTTP 200 and two open-access records during implementation.
