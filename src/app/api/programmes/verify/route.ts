import { verifyProgrammeCertificate } from "@/lib/programme-verification";
import { programmeResponse, programmeHttpFailure } from "@/lib/programme-http";

export async function GET(request: Request) { try { return programmeResponse(await verifyProgrammeCertificate(new URL(request.url).searchParams.get("code") || "")); } catch (error) { return programmeHttpFailure(error); } }
