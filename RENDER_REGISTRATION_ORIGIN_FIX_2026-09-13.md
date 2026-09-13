# Render student-registration origin fix

## Reported problem

Creating a student account returned `Request origin is not permitted.`

## Cause

Render terminates the public HTTPS connection at its reverse proxy. Next.js can
therefore receive an internal HTTP request URL while the browser correctly
sends the public `https://...onrender.com` Origin. Comparing those two URLs
directly produced a false cross-site rejection.

## Resolution

- Accept browser-controlled `Sec-Fetch-Site: same-origin` requests.
- Reconstruct the public origin from Render's `X-Forwarded-Host` and
  `X-Forwarded-Proto` headers when fetch metadata is unavailable.
- Recognise configured `APP_URL`, `NEXT_PUBLIC_APP_URL`,
  `RENDER_EXTERNAL_URL` and `AUTH_URL` values.
- Continue rejecting genuine cross-site and mismatched-origin requests.
- Retain the overlay-safe manual-course importer compatibility exports so the
  previous Render build failure cannot return when files are uploaded through
  GitHub's browser interface.

## Verification

- 10 automated tests passed, including reverse-proxy and hostile-origin cases.
- ESLint completed with 0 errors.
- Next.js 16.2.6 production build completed successfully.
