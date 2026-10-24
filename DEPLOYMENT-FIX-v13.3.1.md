# v13.3.1, repair the missing corporate component imports

The supplied Render log installs dependencies and compiles webpack successfully. It then fails TypeScript checking on these three imports in `components/platform-home.tsx`:

```text
@/components/corporate-assessment-settings
@/components/corporate-assessment-review
@/components/corporate-assessment-learner
```

This application uses `src` as its source tree. The matching files must be:

```text
src/components/platform-home.tsx
src/components/corporate-assessment-settings.tsx
src/components/corporate-assessment-review.tsx
src/components/corporate-assessment-learner.tsx
```

The uploaded GitHub archive confirms that the root `components/` folder contains the three corporate files and the newer `platform-home.tsx`, while `src/components/` lacks those three files and holds the older platform component. The previous TypeScript configuration included the root folder, so its imports failed while webpack compiled the older separate application under `src`. This failure was reproduced locally. All 79 root component files have matching current copies under `src/components` in the cleaned release. See `GITHUB-CLEANUP.md` for the exact removals and preserved folders.

## What this repair changes

- TypeScript checks the application under `src`. The alias `@/*` resolves to `./src/*`. Obsolete root `components`, `app` and `lib` copies are excluded from this project's type and lint inputs.
- Docker excludes those obsolete root application folders from its build context. The complete application remains under `src`, and `public` stays at the repository root.
- The Docker build checks the exact required corporate component paths and reports a clear incomplete-upload message before compilation if any are missing.
- `next.config.mjs` checks the required source, API and startup files before a production source build. It reports missing files and invalid source configuration directly. A native build also rejects a root `app` or `pages` folder that would override `src` routes.
- The optional `npm run check:source` command checks the same source layout and the three route wrappers. No new prebuild lifecycle script is required.
- Genuine TypeScript errors in `src` still fail the build. `ignoreBuildErrors` is not enabled.

All corporate features remain optional, individually selected by the facilitator and off by default. This repair does not change courses, enrolments, fees, assessment settings, the database or provider credentials.

## Upload and redeploy

1. Extract the complete v13.3.1 ZIP. Its top level contains `package.json`, `Dockerfile`, `src`, `public` and `scripts`.
2. Upload those extracted folders and configuration files into the existing repository root. Preserve every subfolder beneath `src`. Uploading files only to a root `components` folder cannot update the application under `src/components`.
3. Replace `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.mjs`, `.dockerignore`, `Dockerfile`, `eslint.config.mjs` and `check-route-layout.mjs` together with the complete `src` and `scripts` folders. The ZIP includes all of them. Keep `.node-version` too.
4. Commit the changes. Check that the repository shows version **13.3.1** in `package.json` and contains all three corporate component files at the exact `src/components` paths above.
5. In the existing Render Docker service, use **Manual Deploy → Clear build cache & deploy**. Retain the existing disk, environment variables and Docker entrypoint. No extra native build or start command is needed for that service.
6. The log should show `ucc-microcredentials@13.3.1 build`, followed by Next.js **16.4.3**. After deployment, check `/api/health/live` and sign in to the existing platform.

For a local source checkout, the corresponding checks are:

```sh
npm ci --include=dev
npm run check:source
npm run build
```

Use Node 22.23.4. The existing native-host startup instructions in `DEPLOYMENT-v13.3.0.md` still apply. This release contains the same persistent-storage and standalone-startup support.

## Dependency audit in the supplied log

The four audit findings are separate from the missing imports. Targeted updates replace Next.js and its ESLint configuration with 16.4.3, Nodemailer with 10.1.4, Zod with 4.6.7 and the affected source-map dependency with its fixed compatible version. The resulting lockfile reports zero known vulnerabilities in `npm audit` on 24 October 2026. AI schema parsing, type checks and the production acceptance suites were rechecked after those updates. This is a current audit result, not a guarantee against future advisories.

The npm funding message, newer-npm notice and missing build-cache warning did not cause this TypeScript failure.

Actual deployment to your Render account remains to be verified. See `VALIDATION-v13.3.1.md` for the local build, source-layout reproduction and regression results.
