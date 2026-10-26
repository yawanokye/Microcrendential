# Learner discovery — v13.6.1

Learners can now use **Learn** in the homepage header to explore microcredentials, CPD, full certificates/diplomas and degree programmes. The five-column menu also links to published subjects, award levels and UCC partners, with digital skills searches for AI, data science, coding and cybersecurity. Counts and provider names come from the approved public catalogue.

`/explore` provides shareable type, subject, award, provider and search filters. A course or programme details dialog shows duration, fees, payment responsibility, entry requirements and available outcomes before sign-in. Learners sign in to enrol or apply through the existing portal. The learner sidebar and mobile navigation include **Explore offerings**.

Public discovery uses the existing server-filtered public API. Private employee training appears only in the eligible learner's portal. Selecting an unpopulated topic shows an empty state. No unpublished programme names or synthetic marketing courses are introduced.

Advanced certificates and postgraduate diplomas now classify as full certificate programmes; only bachelor's, master's and doctoral awards classify as degrees. The mobile homepage's decorative orbit positions have been contained to remove sideways scrolling.

## Validation

Use Node 22 and the existing production build:

- `npm run typecheck`
- `npm test`
- `npm run lint`
- `npm run build`
- `npm run test:catalogue`
- `npm run test:discovery`

The discovery browser acceptance script uses an isolated synthetic database and disables external providers. Set `TEST_CHROMIUM_EXECUTABLE` when Chromium is not installed in Playwright's default location. No new application dependencies or environment variables are required. Test result summaries are under `validation/discovery-v13.6.1/`.

Keep the existing Render service, persistent disk and environment settings. This update requires no additional service or database migration.
