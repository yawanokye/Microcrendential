# Upload this release to GitHub

This archive is deliberately packaged with `Dockerfile`, `package.json`,
`render.yaml`, `public/` and `src/` at its root.

1. Extract the ZIP locally.
2. In the GitHub repository, replace the existing root-level `src` and `public`
   directories and the root configuration files with the extracted versions.
3. Confirm that `src/lib/manual-course-import.ts` contains only the compatibility
   placeholder and does not contain an `allowedExtensions` declaration.
4. Commit the replacement.
5. In Render, use **Manual Deploy → Clear build cache & deploy**.

Do not upload the containing directory as a new nested folder. Render builds the
repository root and would otherwise continue compiling the older files.
