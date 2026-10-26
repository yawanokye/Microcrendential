import { requireActiveProfile } from "@/lib/accounts";
import { getProgrammeEnrolment, programmeConfig, programmeStudyRecord } from "@/lib/programmes";
import { programmeHttpFailure, programmeResponse } from "@/lib/programme-http";
import { programmeRecordCsv, programmeRecordPdf } from "@/lib/programme-record";

export async function GET(request: Request) {
  const account = await requireActiveProfile(); if (account.error || !account.profile) return account.error;
  try {
    const params = new URL(request.url).searchParams, { enrolment, programme } = await getProgrammeEnrolment(Number(params.get("enrolmentId")), account.profile), config = programmeConfig(programme), record = await programmeStudyRecord(enrolment, programme);
    const format = params.get("format"), name = programme.code.replace(/[^A-Za-z0-9_.-]/g, "_") + "-study-record";
    if (format === "csv" || format === "pdf") return new Response(format === "csv" ? programmeRecordCsv(config, record) : new Uint8Array(await programmeRecordPdf(config, enrolment, record)), { headers: { "content-type": format === "csv" ? "text/csv; charset=utf-8" : "application/pdf", "content-disposition": 'attachment; filename="' + name + "." + format + '"', "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
    return programmeResponse({ recordType: "Programme study record", curriculumVersion: programme.version, programme: config, enrolment, record });
  } catch (error) { return programmeHttpFailure(error); }
}
