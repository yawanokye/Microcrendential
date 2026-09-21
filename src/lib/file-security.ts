const startsWith = (bytes: Uint8Array, signature: number[]) => signature.every((value, index) => bytes[index] === value);

export async function validateIdentityUpload(file: File, allowPdf: boolean) {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const jpeg = startsWith(bytes, [0xff, 0xd8, 0xff]);
  const png = startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const pdf = startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]);
  if (file.type === "image/jpeg" && jpeg) return true;
  if (file.type === "image/png" && png) return true;
  if (allowPdf && file.type === "application/pdf" && pdf) return true;
  return false;
}

export async function validateCertificateImage(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const jpeg = startsWith(bytes, [0xff, 0xd8, 0xff]);
  const png = startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const webp = startsWith(bytes, [0x52,0x49,0x46,0x46]) && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return (file.type === "image/jpeg" && jpeg) || (file.type === "image/png" && png) || (file.type === "image/webp" && webp);
}

export async function hasExecutableSignature(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  return startsWith(bytes, [0x4d, 0x5a]) || startsWith(bytes, [0x7f, 0x45, 0x4c, 0x46]);
}
