import { getStoredMetadata } from "@/lib/render-storage";

const acceptedContentTypes = {
  "national-id": new Set(["image/jpeg", "image/png", "application/pdf"]),
  selfie: new Set(["image/jpeg", "image/png"]),
};

export async function ownsValidIdentityEvidence(email: string, idDocumentKey: string, selfieKey: string) {
  const expected = [
    { key: idDocumentKey, kind: "national-id" as const },
    { key: selfieKey, kind: "selfie" as const },
  ];
  for (const item of expected) {
    if (!item.key.startsWith(`identity-verification/${item.kind}/`)) return false;
    try {
      const metadata = await getStoredMetadata(item.key);
      if (metadata.ownerEmail?.toLowerCase() !== email.toLowerCase()) return false;
      if (metadata.evidenceKind !== item.kind || !acceptedContentTypes[item.kind].has(metadata.contentType)) return false;
    } catch {
      return false;
    }
  }
  return true;
}
