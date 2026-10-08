import { getRawDb } from "@/db/raw";
import { createAuthChallenge, type ChallengePortal, type ChallengePurpose } from "@/lib/auth-challenges";
import { emailDeliveryUserMessage, sendSecurityCode } from "@/lib/email";
import { rejectCrossSiteMutation } from "@/lib/request-security";
export async function POST(request:Request) {
  const origin=rejectCrossSiteMutation(request);if(origin)return origin;
  const p=await request.json() as {challengeId?:string},db=getRawDb(),row=await db.prepare("SELECT email,portal,purpose,created_at FROM auth_challenges WHERE id=? AND used_at IS NULL AND datetime(created_at)>datetime('now','-1 day')").bind(String(p.challengeId||"")).first<{email:string;portal:ChallengePortal;purpose:ChallengePurpose;created_at:string}>();
  if(!row)return Response.json({error:"Return to sign in to request a new code."},{status:400});
  const recent=await db.prepare("SELECT COUNT(*) count FROM auth_challenges WHERE email=? AND datetime(created_at)>datetime('now','-1 hour')").bind(row.email).first<{count:number}>();
  if(Date.now()-Date.parse(`${row.created_at.replace(" ","T")}Z`)<60000||Number(recent?.count)>5)return Response.json({error:"Please wait before requesting another code."},{status:429});
  try {const challenge=await createAuthChallenge(row.email,row.portal,row.purpose);await sendSecurityCode(row.email,challenge.code,row.purpose);return Response.json({challengeId:challenge.id,expiresAt:challenge.expiresAt});}
  catch(error){return Response.json({error:emailDeliveryUserMessage(error)},{status:503});}
}
