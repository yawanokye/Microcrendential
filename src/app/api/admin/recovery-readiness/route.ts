import { requireActiveProfile } from "@/lib/accounts";
import { getRawDb } from "@/db/raw";
import { rejectCrossSiteMutation } from "@/lib/request-security";
import { recordAudit } from "@/lib/audit";

export async function POST(request:Request){
  const origin=rejectCrossSiteMutation(request);if(origin)return origin;
  const account=await requireActiveProfile(["admin"]);if(account.error||!account.profile)return account.error;
  const body=await request.json() as {date?:string;reference?:string;confirmed?:boolean};
  const date=String(body.date||""),reference=String(body.reference||"").trim().slice(0,300),timestamp=Date.parse(date);
  if(body.confirmed!==true||!Number.isFinite(timestamp)||timestamp>Date.now()||timestamp<Date.now()-90*24*60*60*1000||reference.length<8)return Response.json({error:"Record a recent restore date and reference, then confirm that the encrypted offsite backup was restored and checked."},{status:400});
  await getRawDb().prepare("INSERT INTO platform_settings(setting_key,setting_value,updated_by_email) VALUES('backup_recovery_drill',?,?) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_by_email=excluded.updated_by_email,updated_at=CURRENT_TIMESTAMP").bind(JSON.stringify({date,reference}),account.profile.email).run();
  await recordAudit(account.profile.email,"recovery.drill_recorded",{date,reference});
  return Response.json({recorded:true});
}
