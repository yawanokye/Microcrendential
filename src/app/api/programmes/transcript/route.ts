import { requireActiveProfile } from "@/lib/accounts";
import { getProgrammeEnrolment, programmeConfig, programmeStudyRecord } from "@/lib/programmes";
import { programmeResponse, programmeHttpFailure } from "@/lib/programme-http";
import { createTranscriptPdf, transcriptCsv } from "@/lib/programme-documents";
import { buildProgrammeTranscript } from "@/lib/programme-transcript";
import { programmePublicOrigin } from "@/lib/programme-verification";

export async function GET(request: Request) {
  const account = await requireActiveProfile(); if (account.error || !account.profile) return account.error;
  try {
    const p = new URL(request.url).searchParams, { enrolment, programme } = await getProgrammeEnrolment(Number(p.get("enrolmentId")), account.profile), record = await programmeStudyRecord(enrolment, programme), transcript = buildProgrammeTranscript(programmeConfig(programme), enrolment, record, programme.version), format = p.get("format");
    const url = record.certificate ? programmePublicOrigin(request) + "/verify-programme?c=" + encodeURIComponent(record.certificate.credential_code) : undefined;
    if (format === "pdf" || format === "csv") return new Response(format === "csv" ? transcriptCsv(transcript) : new Uint8Array(await createTranscriptPdf(transcript, url)), { headers: { "content-type": format === "csv" ? "text/csv; charset=utf-8" : "application/pdf", "content-disposition": 'attachment; filename="' + programme.code.replace(/[^A-Za-z0-9_.-]/g, "_") + '-transcript.' + format + '"', "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
    return programmeResponse({ transcript });
  } catch (error) { return programmeHttpFailure(error); }
}
