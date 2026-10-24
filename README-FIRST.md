# UCC Growth+ v13.3.1

Start with `DEPLOYMENT-FIX-v13.3.1.md`. The new Render log fails on missing corporate component imports in a root `components/platform-home.tsx` copy. This release restores a single canonical `src` tree, checks required files before compilation and updates the affected dependencies. `DEPLOYMENT-v13.3.0.md` remains the general startup and persistent-storage guide. Actual deployment to your Render account has not been performed here.

The supplied GitHub archive has now been compared with this release. `GITHUB-CLEANUP.md` lists the exact obsolete root paths to delete after updating `src`, the folders to retain, and the optional patch for applying all changes to that snapshot. Old repair notes are archived under `docs/archive/`.

`CORPORATE-ASSURANCE-v13.3.0.md` explains employee identity checks, prompted camera evidence, workplace tasks, oral follow-ups, competency thresholds and reports. **Every new corporate control is optional, independently selected by the facilitator and disabled by default.** Enabling the master switch does not select any control. Published changes still require the normal approval process.

The ZIP contains the complete application with `package.json`, `Dockerfile` and `src` directly at its root. Upload the extracted contents to the existing repository root, preserving your persistent disk and existing environment variables. Do not upload the ZIP itself as application source.

Use Node 22.23.4. For a native Node deployment:

```sh
npm ci --include=dev
npm run build
npm start
```

The included `render.yaml` keeps the existing Docker deployment path. `render-native.yaml` is an alternative template, not an instruction to create a second service.

The previous AI authoring, live AI diagnostics and H5P/LTI features are retained. See `LIVE-AI-LTI-v13.2.0.md` for provider and tool registration. Actual live provider verification requires configured credentials. No successful live AI or customer H5P connection is claimed by this package.

See `VALIDATION-v13.3.1.md` for current checks and limits. `npm run check:source` checks upload layout before a build. `npm run pilot:check` runs lint, unit tests, type checks and the production build. Browser acceptance suites also require Playwright and Chromium, which are test tools rather than production dependencies.
