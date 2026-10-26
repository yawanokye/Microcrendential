import { isPrivateOffering } from "./catalogue-access";
import { getRawDb } from "@/db/raw";
import { synchroniseProgrammeCredential, type ProgrammeCertificate, type ProgrammeCertificateSnapshot } from "./programme-credentials";

export function programmePublicOrigin(request: Request) { const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.RENDER_EXTERNAL_URL; if (configured) { try { return new URL(configured).origin; } catch {} } const url = new URL(request.url), host = request.headers.get("host"), scheme = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim(); if (host && /^[a-zA-Z0-9.:[\]-]+$/.test(host)) url.host = host; if (scheme === "http" || scheme === "https") url.protocol = scheme + ":"; return url.origin; }
export async function verifyProgrammeCertificate(value: string) {
  const code = value.trim().toUpperCase(); if (!/^UCC-PG-\d{4}-[A-F0-9]{14}$/.test(code)) return { valid: false, status: "not_found", certificate: null };
  const db = getRawDb(); let row = await db.prepare("SELECT * FROM programme_certificates WHERE credential_code=?").bind(code).first<ProgrammeCertificate>();
  if (!row) return { valid: false, status: "not_found", certificate: null };
  await synchroniseProgrammeCredential(row.enrolment_id);
  row = await db.prepare("SELECT * FROM programme_certificates WHERE credential_code=?").bind(code).first<ProgrammeCertificate>();
  if (!row) return { valid: false, status: "not_found", certificate: null };
  const s = JSON.parse(row.snapshot_json) as ProgrammeCertificateSnapshot;
  if(isPrivateOffering("programme",s.programmeCode))return {valid:row.status==="active",status:row.status,restricted:true,certificate:null};
  return { valid: row.status === "active", status: row.status, certificate: { code: row.credential_code, learnerName: s.learnerName, qualificationTitle: s.qualificationTitle, programmeCode: s.programmeCode, award: s.award, issuer: "University of Cape Coast", credits: s.credits, awardDate: s.awardDate, issuedAt: row.issued_at, curriculumVersion: s.curriculumVersion } };
}
