# UCC Growth+ v13.0.3 - remove the missing prebuild script dependency

The reported deployment stops before Next.js runs because `package.json` calls `scripts/check-route-layout.mjs`, which is absent from the uploaded build context. This release removes that lifecycle hook. Next.js still compiles the application and checks its TypeScript types during `npm run build`.

## Fix the existing v13.0.2 deployment

1. Extract the small build-fix ZIP.
2. Open the root of the existing GitHub repository.
3. Replace **package.json** and **package-lock.json** with the two files from the ZIP. These are the only application files needed for this particular error.
4. Commit both files and redeploy the new commit in Render.
5. The build must show `ucc-microcredentials@13.0.3 build`, followed directly by `next build --webpack`. It must no longer run a `prebuild` command.

Alternatively, remove the line `"prebuild": "node scripts/check-route-layout.mjs",` from the existing `package.json` and commit that edit. The prepared package files also update the release label to v13.0.3 so the deployed version is easy to recognise.

No environment-variable, database or Dockerfile change is needed for this error. An old copy of the layout-check script can remain in the repository because the build no longer calls it. Do not replace the repository with the small ZIP alone.

The complete source release retains the previously repaired landing, facilitator and learner pages and existing course/lesson URL support. If other application files were not uploaded correctly, Next.js will still report their compilation or type errors. This change removes the missing helper dependency and does not suppress application validation.

The six high-severity npm audit findings in the supplied log are separate from this build-stopping error. This patch does not change third-party dependency versions or claim those findings are resolved.

The source is validated locally. Applying the files to GitHub and redeploying Render remain required.
