# Validation — learner discovery v13.6.1

Verified on Node 22.23.4 on 26 October 2026:

| Check | Result |
| --- | --- |
| Canonical source layout | Passed |
| TypeScript application and test projects | Passed |
| Unit tests | 150 passed, 3 existing environment capability skips, 0 failed |
| ESLint | 0 errors, 42 existing warnings |
| Clean production build and standalone preparation | Passed |
| Catalogue, privacy and fixed-payment regression | 22 checks passed |
| Desktop/mobile discovery and signed-in navigation | 13 checks passed, no browser errors |

Acceptance used isolated synthetic data and disabled external providers. Browser verification covered the five-column menu, all four offering routes, award filters, course/programme details, search URL state, honest empty results, keyboard opening and dismissal, outside-click dismissal, phone-width scrolling and the learner's return to eligible private employee training. Public results excluded confidential training.

Screenshots were inspected privately and are not included in the repository. Machine-readable acceptance results are under `validation/discovery-v13.6.1/`. Live AI, H5P providers and payment gateways were not re-exercised for this navigation-only update.
