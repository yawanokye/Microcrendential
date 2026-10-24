# Upload v13.3.1 to GitHub

This archive is deliberately packaged with `Dockerfile`, `package.json`,
`render.yaml`, `public/` and `src/` at its root.

1. Extract the ZIP locally.
2. In the GitHub repository, replace the existing root-level `src` and `public`
   directories and the root configuration files with the extracted versions.
3. Include `scripts`, `tests`, `.node-version`, `package-lock.json` and the
   updated configuration files. Confirm `package.json` shows version `13.3.1`.
4. Commit the replacement.
5. Follow `DEPLOYMENT-FIX-v13.3.1.md` for your existing Docker or native Node service,
   then use a manual deployment. Preserve the existing disk, database and secrets.

Do not upload the containing directory as a new nested folder. Render builds the
repository root and would otherwise continue compiling the older files.
