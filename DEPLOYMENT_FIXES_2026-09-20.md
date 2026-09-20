# Deployment readiness corrections, 20 September 2026

## Corrections included

- Fixed the Node SQLite legacy-revision migration TypeScript error that stopped `next build`.
- Upgraded `next` and `eslint-config-next` from 16.2.6 to 16.3.5.
- Removed unused Cloudflare, Vite, Vinext, Wrangler and Drizzle Kit development packages.
- Added `tsx` as a direct test dependency instead of relying on a transitive package.
- Removed the unused experimental Server Actions upload configuration.
- Fixed both ESLint errors in the learning-activity upload route and Course Studio interface.
- Standardised the Render Vertex credential variable as `GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON_BASE64` while retaining backward compatibility with `GOOGLE_VERTEX_SERVICE_ACCOUNT_BASE64`.
- Added regression tests for Vertex credential detection in both Course Studio AI integrations.
- Excluded TypeScript build-info files from Git and Docker contexts.

## Verification completed

- Clean dependency installation: passed
- Automated tests: 23 passed
- ESLint: passed with warnings only
- TypeScript production check: passed
- Next.js 16.3.5 production build: passed
- Production dependency audit: zero known vulnerabilities
- Node.js 22.13 standalone startup: passed
- `/api/health/live`: HTTP 200
- `/api/health`: HTTP 200 with all readiness checks true
- Homepage: HTTP 200
- SQLite database creation on the configured data path: passed

## Required Render values

- `INITIAL_ADMIN_EMAIL`: set to the authorised first administrator email.
- `PAYSTACK_SECRET_KEY`: required before activating paid courses or certificate fees.
- `OPENAI_API_KEY`: required for OpenAI-assisted course design.
- `GOOGLE_CLOUD_PROJECT` and `GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON_BASE64`: required for Vertex AI.
- `NEXT_PUBLIC_APP_URL`: update if the Render service name or public domain differs from the Blueprint default.

Keep `Dockerfile` and `render.yaml` at the GitHub repository root. Do not upload the enclosing extracted folder as an additional repository level.
