# Render storage import hotfix

Replace the repository file at `src/lib/render-storage.ts` with the file in this
package. Keep the filename entirely lowercase and hyphenated exactly as shown.

The replacement exports `putStoredFile`, `getStoredFile`,
`getStoredMetadata`, `deleteStoredFile`, and
`deleteIdentityFilesOwnedBy`. It is compatible with the course-manual import,
course uploads, identity evidence, Colab, virtual-lab evidence, and certificate
signature routes.

After committing the replacement, use **Clear build cache & deploy** in Render.
