import { getRawDb } from "@/db/raw";
import { requireActiveProfile } from "@/lib/accounts";
import { rejectCrossSiteMutation } from "@/lib/request-security";
import { CatalogueError, manageOrganisation } from "@/lib/catalogue-management";
export async function GET(request:Request){const account=await requireActiveProfile(["admin"]);if(account.error)return account.error;const org=Number(new URL(request.url).searchParams.get("organisationId"));return Response.json(getRawDb().read(db=>({
  organisations:db.prepare("SELECT * FROM learning_organisations ORDER BY name").all(),
  groups:db.prepare("SELECT g.*,o.name organisation_name FROM learning_access_groups g JOIN learning_organisations o ON o.id=g.organisation_id WHERE (?=0 OR o.id=?) ORDER BY o.name,g.name").all(org,org),
  members:org?db.prepare("SELECT m.*,g.name group_name FROM learning_group_members m JOIN learning_access_groups g ON g.id=m.group_id WHERE g.organisation_id=? ORDER BY m.user_email LIMIT 501").all(org):[],
  invoices:org?db.prepare("SELECT i.*,COALESCE((SELECT SUM(amount_pesewas) FROM organisation_receipt_allocations WHERE invoice_id=i.id),0) paid_pesewas FROM learning_invoices i WHERE organisation_id=? ORDER BY id DESC LIMIT 200").all(org):[],
  receipts:org?db.prepare("SELECT r.*,COALESCE((SELECT SUM(amount_pesewas) FROM organisation_receipt_allocations WHERE receipt_id=r.id),0) allocated_pesewas FROM organisation_receipts r WHERE organisation_id=? ORDER BY id DESC LIMIT 200").all(org):[]
})));}
export async function POST(request:Request){const origin=rejectCrossSiteMutation(request);if(origin)return origin;const account=await requireActiveProfile(["admin"]);if(account.error||!account.profile)return account.error;try{const p=await request.json();const result=manageOrganisation(account.profile,p);return Response.json({result},{status:201});}catch(error){return Response.json({error:error instanceof Error?error.message:"Organisation update failed."},{status:error instanceof CatalogueError?error.status:400});}}
