# v13.3.1 validation

Validated on 24 October 2026 using Node 22.23.4 and Next.js 16.4.3. All test accounts and data were synthetic. No user database, live AI account, customer H5P tool, email service or payment service was contacted.

## Reported failure and repair

The exact three missing-import errors in the supplied log were reproduced using a root `components/platform-home.tsx` copy alongside an older `src` version and missing corporate component files. The expected errors are retained in `validation/deployment-fix-v13.3.1/reproduced-original-error.log`.

The subsequently supplied GitHub archive confirms this exact layout. Every one of its 79 root component files matches the repaired canonical component copy. All existing functional source, SQL migration, public, certificate-asset and tool paths are retained. The archive comparison is recorded in `github-archive-comparison.json`. Historical root documents and earlier repair records were moved under `docs/archive/` with local Markdown links updated.

The repaired configuration and complete source pass type checking with an intentionally invalid obsolete root component still present. A fresh production build also passes with that unused root file present. A deliberate type error added to the real `src` tree still fails with TS2322. This confirms that the repair excludes obsolete inputs without suppressing application type checking.

An actual Next production build with a required corporate component removed fails immediately with `Release source check failed` and names its exact `src/components` path. Seven additional automated tests cover complete and incomplete layouts, misplaced components, root route overrides, stale aliases and includes, malformed configuration, and standalone runtime startup without a source tree.

## Results

| Check | Result |
| --- | --- |
| Fresh lockfile install in a separate source directory | Passed, 550 installed packages |
| Production webpack build with an obsolete root component present | Passed |
| Standalone assets and production start | Passed |
| Application and test type checks | Passed |
| ESLint | 0 errors, 42 existing warnings |
| Unit tests | 102 total, 99 passed, 3 skipped, 0 failed |
| Commercial production API and PDF checks | 46 passed |
| Native interactive activity API | 23 passed |
| Commercial learner/facilitator browser workflow | 14 passed |
| Course Studio/native activity browser workflow | 14 passed |
| AI diagnostic controls and mock LTI integration | 25 passed |
| Optional corporate assessment API/browser workflow | 33 passed |
| Total production acceptance checks | 155 passed |
| `npm audit` after targeted dependency updates | 0 known findings |

The three skipped storage tests require CHOWN, SETUID and SETGID capabilities unavailable in the test environment. The existing Docker disk-permission entrypoint was retained. Docker and Podman were unavailable, so no complete Docker image build or actual Render deployment is claimed. The source build and the production launcher were tested locally.

## Dependency changes

Next.js and eslint-config-next are pinned to 16.4.3, Nodemailer to 10.1.4 and Zod to 4.6.7. The affected source-map-js dependency resolves to a fixed compatible version in the lockfile. The before/after audit JSON is included. Existing AI schema tests, type checks, browser workflows and integration tests pass with these versions. No blanket `npm audit fix --force` was used.

The audit result describes the registry's known findings on the validation date and does not rule out future advisories.

## Preserved behavior and limits

Every corporate feature remains optional, independently selected by the facilitator and disabled by default. Ordinary courses make no corporate-session or camera request. The corporate tests check server-held question snapshots, private camera evidence, task and competency thresholds, supervised alternatives, review history, browser recovery, credential withholding and administrator-governed restoration.

Camera input was synthetic and is collected for human review. No automated facial recognition or guaranteed liveness is claimed. LTI launch, content selection and grade return were tested against a mock tool. Actual provider credentials and the institution's H5P registration still require their own live diagnostics. Browser screenshots are internal QA material and are excluded from the package. Text logs and JSON results are included.
