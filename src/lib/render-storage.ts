import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";

export type StoredMetadata = { contentType: string; originalName: string; ownerEmail?: string; evidenceKind?: string };
const root = () => join(process.env.DATA_DIR || join(process.cwd(), ".data"), "uploads");
const safePath = (key: string) => {
  const storageRoot = resolve(root());
  const target = resolve(storageRoot, key);
  if (target !== storageRoot && !target.startsWith(`${storageRoot}${sep}`)) throw new Error("Invalid storage key.");
  return target;
};

export async function putStoredFile(prefix: string, file: File, metadata: StoredMetadata) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-"); const key = `${prefix}/${crypto.randomUUID()}-${safeName}`; const target = safePath(key);
  await mkdir(dirname(target), { recursive: true }); await writeFile(target, new Uint8Array(await file.arrayBuffer())); await writeFile(`${target}.json`, JSON.stringify(metadata), "utf8");
  return key;
}

export async function getStoredFile(key: string) {
  const target = safePath(key); const [body, metadata] = await Promise.all([readFile(target), readFile(`${target}.json`, "utf8").then((value) => JSON.parse(value) as StoredMetadata)]);
  return { body, metadata };
}

export async function getStoredMetadata(key: string) {
  const target = safePath(key);
  return JSON.parse(await readFile(`${target}.json`, "utf8")) as StoredMetadata;
}

const removeIfPresent = async (path: string) => {
  try {
    await unlink(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
};

export async function deleteStoredFile(key: string) {
  const target = safePath(key);
  const [removedFile, removedMetadata] = await Promise.all([
    removeIfPresent(target),
    removeIfPresent(`${target}.json`),
  ]);
  return removedFile || removedMetadata;
}

export async function deleteIdentityFilesOwnedBy(emails: string[]) {
  const owners = new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean));
  if (!owners.size) return 0;
  let removed = 0;
  for (const kind of ["national-id", "selfie"] as const) {
    const prefix = `identity-verification/${kind}`;
    const directory = safePath(prefix);
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      const key = `${prefix}/${entry.name.slice(0, -5)}`;
      try {
        const metadata = await getStoredMetadata(key);
        if (metadata.evidenceKind !== kind || !metadata.ownerEmail || !owners.has(metadata.ownerEmail.toLowerCase())) continue;
        if (await deleteStoredFile(key)) removed += 1;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
      }
    }
  }
  return removed;
}
