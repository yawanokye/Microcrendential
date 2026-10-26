import { getRawDb } from "@/db/raw";
import { requireActiveProfile } from "@/lib/accounts";
import { getProgrammeEnrolment, ProgrammeError } from "@/lib/programmes";
import { programmeResponse, programmeHttpFailure } from "@/lib/programme-http";
import type { ProgrammeCertificate, ProgrammeCertificateSnapshot } from "@/lib/programme-credentials";
import { createProgrammeCertificatePdf } from "@/lib/programme-documents";
import { programmePublicOrigin } from "@/lib/programme-verification";

export async function GET(request: Request) {
  const account = await requireActiveProfile(); if (account.error || !account.profile) return account.error;
  try {
    const p = new URL(request.url).searchParams, { enrolment } = await getProgrammeEnrolment(Number(p.get("enrolmentId")), account.profile), certificate = await getRawDb().prepare("SELECT * FROM programme_certificates WHERE enrolment_id=?").bind(enrolment.id).first<ProgrammeCertificate>();
    if (!certificate) throw new ProgrammeError("The programme certificate is awaiting the configured completion and release requirements.", 409);
    const snapshot = JSON.parse(certificate.snapshot_json) as ProgrammeCertificateSnapshot;
    if (p.get("format") !== "pdf") return programmeResponse({ certificate: { code: certificate.credential_code, status: certificate.status, learnerName: snapshot.learnerName, qualificationTitle: snapshot.qualificationTitle, issuedAt: certificate.issued_at } });
    if (certificate.status !== "active") throw new ProgrammeError("This programme certificate is not currently valid for download.", 410);
    const pdf = await createProgrammeCertificatePdf(certificate, programmePublicOrigin(request) + "/verify-programme?c=" + encodeURIComponent(certificate.credential_code));
    return new Response(new Uint8Array(pdf), { headers: { "content-type": "application/pdf", "content-disposition": 'attachment; filename="' + snapshot.programmeCode.replace(/[^A-Za-z0-9_.-]/g, "_") + '-certificate.pdf"', "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
  } catch (error) { return programmeHttpFailure(error); }
}
