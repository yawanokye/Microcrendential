# Clean the GitHub repository for v13.5.0

Use the complete v13.5.0 ZIP for the current update. The v13.3.1 patch below is a historical repair for the supplied older GitHub snapshot and does not include working labs, Python or full programme delivery. Keep the new `src/app/api/programmes/` routes and programme source modules. Keep `public/vendor/pyodide/`, including its required `python_stdlib.zip`, and all `src/app/api/learning-labs/` routes. See `FULL-PROGRAMMES-v13.5.0.md` for the current file list and deployment steps.

The supplied `Microcrendential-master (12).zip` confirms the deployment problem. The root `components/` folder contains all three current corporate assessment components, but they are absent from `src/components/`. Its `platform-home.tsx` is also newer than the one under `src`. All 79 files in the root component folder match the current components in this cleaned release.

This ZIP contains the complete corrected application. The current component files are under `src/components/`, the route pages remain under `src/app/`, and the root configuration files target that source tree. Historical repair notes have been retained under `docs/archive/`.

## Delete these obsolete root paths after uploading the corrected src folder

| Root path in the uploaded GitHub snapshot | Reason |
| --- | --- |
| `components/` | 79 duplicate or misplaced files. Their correct current copies are retained under `src/components/`. Delete the root folder, not `src/components/`. |
| `platform-home.tsx` | Older misplaced component. Use `src/components/platform-home.tsx`. |
| `learning-page.tsx` | Misplaced page component. Use `src/components/learning-page.tsx`. |
| `page.tsx` | Misplaced facilitator route. Use `src/app/facilitator-studio/page.tsx`. |
| `page (1).tsx` | Misplaced learner route. Use `src/app/learn/page.tsx`. |
| `page (2).tsx` | Misplaced landing route. Use `src/app/page.tsx`. |
| `test-commercial-api.mjs` | Older root test copy. Use `scripts/test-commercial-api.mjs`. |
| `tsconfig.tsbuildinfo` | Generated compiler cache. It should not be committed. |
| `PACKAGE-MANIFEST.json` | Old v13.2 package record, not the manifest for this source. |
| `RELEASE-MANIFEST-v13.3.0.json` | Stale release checksums. The cleaned package provides the current release manifest. |
| `api-results.json` | Older root test output, archived as `docs/archive/api-results-legacy.json`. Current checks are versioned under `validation/deployment-fix-v13.3.1/`. |
| `UCC-GrowthPlus-Repository-Repair.patch` | Older repair patch, retained under `docs/archive/`. Use the current cleanup patch only for the supplied GitHub snapshot. |

The exact root document moves and every removed path are listed in `maintenance/github-cleanup-plan.json`. The historical Markdown files listed there have moved into `docs/archive/`. Remove their old root copies after uploading the archived copies. Current entry-point documents remain at the repository root.

## Keep these application folders and settings

Keep `src/`, `public/`, `scripts/`, `tests/`, `database/`, `certificate-assets/` and `tools/`. The SQL migrations, migration metadata, certificate templates and crest assets from the uploaded repository are retained.

Keep the root `Dockerfile`, `.dockerignore`, `.env.example`, `.gitignore`, `.node-version`, `package.json`, `package-lock.json`, `next.config.mjs`, `next-env.d.ts`, `tsconfig.json`, `tsconfig.tests.json`, `eslint.config.mjs`, `postcss.config.mjs`, `components.json`, `check-route-layout.mjs` and Render configuration files. `components.json` is the UI library configuration, not the obsolete `components/` source folder.

Keep the existing Render disk, database and environment secrets. This cleanup does not require removing `/var/data` or recreating the service.

`docs/archive/` and `validation/` are optional in the GitHub repository once their records are stored elsewhere. They are not runtime dependencies. The cleaned package retains historical documents and text/JSON validation evidence, while browser screenshots and generated test PDFs are excluded. If `node_modules/`, `.next/` or live `.data/` folders have separately been committed to GitHub, remove them from version control and keep their existing ignore rules. Do not delete the live Render data disk.

## Apply the cleaned version

With GitHub's web uploader, upload the complete extracted contents into the repository root, preserving every subfolder. Then delete the obsolete root paths above. Uploading updated files does not automatically remove older files from GitHub.

For a local Git checkout matching the supplied snapshot, `maintenance/github-cleanup-v13.3.1.patch` applies the source updates, moves and removals together. Keep the patch outside the checkout until applying it, then run from the repository root:

```sh
git apply --check /path/to/github-cleanup-v13.3.1.patch
git apply --index /path/to/github-cleanup-v13.3.1.patch
git diff --cached --stat
```

The first command must pass before applying the patch. A changed repository may need the complete ZIP and manual review instead. Commit the resulting changes, then redeploy the existing Render service. After uploading the complete current package, the version must show **13.5.0**. See `DEPLOYMENT-FIX-v13.3.1.md` for the build and deployment steps.

All corporate features remain optional and off by default. The cleanup does not alter course fees, existing enrolments, approval settings or learner records.
