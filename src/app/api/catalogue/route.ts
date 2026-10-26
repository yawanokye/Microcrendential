import { getRawDb } from "@/db/raw";
import { requireActiveProfile } from "@/lib/accounts";
import { rejectCrossSiteMutation } from "@/lib/request-security";
import { activeGroupsNative, offeringOwnerNative, policyGroupsNative } from "@/lib/catalogue-access";
import { currentBillingNative } from "@/lib/learning-billing";
import { offeringKind } from "@/lib/catalogue-policy";
import { CatalogueError, previewAudience, saveAudience, saveBilling } from "@/lib/catalogue-management";
export async function GET(request:Request) {
  const account=await requireActiveProfile(["admin","facilitator"]);if(account.error||!account.profile)return account.error;
  const actor=account.profile, params=new URL(request.url).searchParams;
  try { return Response.json(getRawDb().read(db=>{
    const groups=actor.role==="admin"?db.prepare("SELECT g.*,o.name organisation_name FROM learning_access_groups g JOIN learning_organisations o ON o.id=g.organisation_id ORDER BY o.name,g.name").all():activeGroupsNative(db,actor.email,true);
    const code=(params.get("code")||"").trim().toUpperCase();
    if(code){const kind=offeringKind(params.get("kind")),owner=offeringOwnerNative(db,kind,code);if(!owner||actor.role!=="admin"&&owner.created_by_email!==actor.email)throw new CatalogueError("Offering not found.",404);const policy=db.prepare("SELECT visibility,version FROM offering_access WHERE offering_kind=? AND offering_code=?").get(kind,code)||{visibility:"public",version:0};return {kind,code,policy,groupIds:policyGroupsNative(db,kind,code),billing:currentBillingNative(db,kind,code),groups};}
    const courses=db.prepare("SELECT 'course' kind,code,title,status FROM course_drafts WHERE (?='admin' OR created_by_email=?) ORDER BY title LIMIT 1000").all(actor.role,actor.email);
    const programmes=db.prepare("SELECT 'programme' kind,code,title,status FROM academic_programmes p WHERE version=(SELECT MAX(version) FROM academic_programmes v WHERE v.code=p.code) AND (?='admin' OR created_by_email=?) ORDER BY title LIMIT 1000").all(actor.role,actor.email);
    return {offerings:[...courses,...programmes],groups};
  })); }catch(error){return failure(error);}
}
export async function POST(request:Request){const origin=rejectCrossSiteMutation(request);if(origin)return origin;const account=await requireActiveProfile(["admin","facilitator"]);if(account.error||!account.profile)return account.error;
  try {const p=await request.json() as Record<string,unknown>,kind=offeringKind(p.kind),code=String(p.code||"").trim().toUpperCase();const result=p.action==="preview"?previewAudience(account.profile,{...p,kind,code}):p.action==="audience"?saveAudience(account.profile,{...p,kind,code}):p.action==="fees"?saveBilling(account.profile,{...p,kind,code}):null;if(result===null)throw new CatalogueError("Choose an audience or fees action.");return Response.json({result});}catch(error){return failure(error);}
}
function failure(error:unknown){return Response.json({error:error instanceof Error?error.message:"Catalogue update failed."},{status:error instanceof CatalogueError?error.status:400});}
