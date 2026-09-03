import { mkdir, readFile, writeFile } from "node:fs/promises";
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
