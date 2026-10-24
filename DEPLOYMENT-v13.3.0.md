# Deploy UCC Growth+ v13.3.0

The previous update was reported unable to deploy. No build or runtime log was available, so its original failure is not confirmed. This release corrects production packaging and startup inconsistencies and includes fresh-install validation. A successful local production test is not evidence of a successful Render deployment.

## What changed

- Node 22 is required, with 22.23.4 selected in `.node-version`. The engine range has an upper bound so a native host cannot silently choose Node 24.
- `npm run build` creates the Next standalone server and automatically includes `public`, `.next/static` and maintenance scripts. The previous `next start` command has been replaced by a standalone-aware production launcher.
- `npm start` checks the Node version, generated files and writable data directories before starting the server and its existing maintenance worker. It binds to `0.0.0.0` and the host-provided `PORT`.
- Relative native storage paths are resolved from the extracted project root, preserving the existing default database location. For persistent hosting, use the existing absolute disk paths.
- Docker explicitly installs development dependencies during the build. TypeScript and build tools must be installed even when `NODE_ENV=production` is set by the host.
- Build worker concurrency is limited to two to reduce build resource pressure. The existing PDF worker tracing remains included.
- The application files are at the ZIP root. No versioned wrapper directory is required as the host's root directory.

## Update the existing service

1. Download or verify a current application/database backup using the existing backup process. Keep the current persistent disk and `AUTH_SECRET`.
2. Extract the complete ZIP and replace the application source in the existing repository root. Preserve the hierarchy under `src`, `public` and `scripts`. Include `.node-version`, `package-lock.json`, `next.config.mjs` and `Dockerfile`.
3. Keep the existing Render service type. Use the Docker instructions below for a Docker service, or the Node instructions for a native Node service. Do not create a new service just to adopt this release.
4. Retain the current environment variables and the existing disk mounted at `/var/data`. Do not replace existing secrets with example values or reset the database. Leave the demonstration/pilot settings as already approved for your deployment.
5. Build and deploy the new source. After the service starts, open `/api/health/live`, then inspect `/api/health` for configuration readiness. Confirm sign-in, course access and one draft save before enabling any optional corporate setting.

### Existing Docker service

Use the included `Dockerfile` and existing `render.yaml`. The root directory should be the directory containing `Dockerfile` and `package.json`, normally blank for a repository-root upload. Use the image's default entrypoint and command. The runtime entrypoint repairs the application's mounted-disk permissions and then drops to the restricted application user. Do not override it with `next start`.

The image installs, builds and copies the standalone application itself. Do not set a separate native Node build command on this Docker service. The health check remains `/api/health/live` and the disk remains `/var/data`.

### Existing native Node service

Set `NODE_VERSION=22.23.4` or allow the included `.node-version` to select it. Set these commands from the extracted project root:

```sh
# Build command
npm ci --include=dev && npm run build

# Start command
npm start
```

Keep:

```text
NODE_ENV=production
DATA_DIR=/var/data
SQLITE_PATH=/var/data/ucc-microcredentials.sqlite
BACKUP_DIR=/var/data/backups
```

The host supplies `PORT`. The launcher uses `0.0.0.0` without depending on the host's `HOSTNAME` value. Leave `APP_BIND_HOST` unset for Render. Ensure the existing disk is writable by the native service user. `render-native.yaml` shows the equivalent native configuration and carries the existing environment template; it is an alternative to `render.yaml`.

## If deployment still fails

Use the first failing build or runtime message to identify the stage. Useful checks are:

| Message or symptom | Check |
| --- | --- |
| `package.json` or `Dockerfile` missing | Repository root and host root-directory setting |
| Unsupported Node or `node:sqlite` unavailable | Node 22.23.4 and a rebuild using the selected version |
| TypeScript, Tailwind or build tool missing | `npm ci --include=dev` during build |
| Standalone server or static assets missing | Run the complete `npm run build`, not just `next build` |
| Permission error under `/var/data` | Existing disk mount and service-user permissions; retain the Docker entrypoint |
| Port detection or health timeout | `PORT`, binding, `/api/health/live`, first runtime error |
| Build killed by the host | Build log and host memory limit; the release limits worker concurrency but cannot change the plan's memory allowance |

Keep real provider keys in the host environment. They are not required to build the application. Live AI verification and H5P/LTI connections remain unverified until an administrator connects the actual accounts and runs their diagnostics.

This release creates its new corporate tables lazily and adds no destructive migration. Existing course and enrolment snapshots remain governed by normal version approval. Rollback the application code together with its pre-update backup if an operational rollback is required; do not delete the persistent disk.

Official references: [Next standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output), [Render Node versions](https://render.com/docs/node-version), [Render Docker deployment](https://render.com/docs/docker).
