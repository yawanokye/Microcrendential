# UCC Growth+ v13.2.0

Start with `LIVE-AI-LTI-v13.2.0.md` for live AI diagnostics, H5P/LTI registration, saved section generation and deployment steps. `VALIDATION-LIVE-AI-LTI-v13.2.0.md` distinguishes tested local behavior from live services requiring configuration.

The extracted project is the complete application. Upload its contents to the repository root, preserving `src`, your existing persistent data disk and environment variables.

Run `npm ci` and `npm run pilot:check` before deployment. The new production API/browser acceptance suite is `npm run test:integrations`. Browser tests require Playwright and Chromium.
