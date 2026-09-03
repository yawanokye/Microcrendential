import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";

export type StoredMetadata = {
  contentType: string;
  originalName: string;
  ownerEmail?: string;
  evidenceKind?: string;
};

const root = () => join(process.env.DATA_DIR || join(process.cwd(), ".data"), "uploads");

const safePath = (key: string) => {
  const storageRoot = resolve(root());
  const target = resolve(storageRoot, key);
  if (target !== storageRoot && !target.startsWith(`${storageRoot}${sep}`)) {
    throw new Error("Invalid storage key.");
  }
  return target;
};

async function removeIfPresent(path: string) {
  try {
    await rm(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export async function putStoredFile(prefix: string, file: File, metadata: StoredMetadata) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const key = `${prefix}/${crypto.randomUUID()}-${safeName}`;
  const target = safePath(key);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, new Uint8Array(await file.arrayBuffer()));
  await writeFile(`${target}.json`, JSON.stringify(metadata), "utf8");
  return key;
}

export async function getStoredFile(key: string) {
  const target = safePath(key);
  const [body, metadata] = await Promise.all([
    readFile(target),
    readFile(`${target}.json`, "utf8").then((value) => JSON.parse(value) as StoredMetadata),
  ]);
  return { body, metadata };
}

export async function getStoredMetadata(key: string) {
  const target = safePath(key);
  return JSON.parse(await readFile(`${target}.json`, "utf8")) as StoredMetadata;
}

/**
 * Delete one stored blob and its sidecar metadata. Missing files are treated as
 * already deleted so account cleanup remains idempotent.
 */
export async function deleteStoredFile(key: string) {
  const target = safePath(key);
  const [fileRemoved, metadataRemoved] = await Promise.all([
    removeIfPresent(target),
    removeIfPresent(`${target}.json`),
  ]);
  return fileRemoved || metadataRemoved;
}

async function metadataFiles(directory: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const files: string[] = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await metadataFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".json")) files.push(path);
  }
  return files;
}

/**
 * Remove identity-verification uploads owned by the supplied accounts. This is
 * deliberately restricted to the identity-verification subtree so deleting
 * user accounts cannot accidentally remove institutional course material.
 */
export async function deleteIdentityFilesOwnedBy(ownerEmails: string[]) {
  const owners = new Set(ownerEmails.map((email) => email.trim().toLowerCase()).filter(Boolean));
  if (owners.size === 0) return 0;

  const storageRoot = resolve(root());
  const identityRoot = safePath("identity-verification");
  const sidecars = await metadataFiles(identityRoot);
  let removed = 0;

  for (const sidecar of sidecars) {
    let metadata: StoredMetadata;
    try {
      metadata = JSON.parse(await readFile(sidecar, "utf8")) as StoredMetadata;
    } catch {
      continue;
    }

    if (!metadata.ownerEmail || !owners.has(metadata.ownerEmail.toLowerCase())) continue;

    const storedPath = sidecar.slice(0, -".json".length);
    const key = relative(storageRoot, storedPath).split(sep).join("/");
    if (await deleteStoredFile(key)) removed += 1;
  }

  return removed;
}
