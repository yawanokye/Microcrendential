import { requireActiveProfile } from "@/lib/accounts";
import { rejectCrossSiteMutation } from "@/lib/request-security";
import { synchroniseProgrammeCredential } from "@/lib/programme-credentials";
import { applyToProgramme, decideProgrammeEnrolment } from "@/lib/programmes";
import { programmePayload, programmeResponse, programmeHttpFailure } from "@/lib/programme-http";

export async function POST(request: Request) {
  const originError = rejectCrossSiteMutation(request); if (originError) return originError;
  const account = await requireActiveProfile(); if (account.error || !account.profile) return account.error;
  try { const p = await programmePayload(request); const id = p.action === "apply" ? await applyToProgramme(account.profile, Number(p.programmeId), p.statement) : await decideProgrammeEnrolment(account.profile, p); await synchroniseProgrammeCredential(id); return programmeResponse({ enrolmentId: id }, 200); } catch (error) { return programmeHttpFailure(error); }
}
