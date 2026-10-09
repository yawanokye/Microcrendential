import { requireActiveProfile } from "@/lib/accounts";
import { getRawDb } from "@/db/raw";
import { ensureAiTables } from "@/lib/course-ai-jobs";
import { interactiveIssues, normalizeInteractive } from "@/lib/interactive-activities";
import { rejectCrossSiteMutation } from "@/lib/request-security";
export async function GET() {
  const account=await requireActiveProfile(["admin","facilitator"]);if(account.error||!account.profile)return account.error;
  ensureAiTables();const rows=await getRawDb().prepare("SELECT id,title,activity_json FROM course_activity_library WHERE owner_email=? ORDER BY created_at DESC LIMIT 100").bind(account.profile.email).all<{id:string;title:string;activity_json:string}>();
  return Response.json({items:rows.results.map(r=>({id:r.id,title:r.title,interactive:JSON.parse(r.activity_json)}))});
}
export async function POST(request:Request) {
  const origin=rejectCrossSiteMutation(request);if(origin)return origin;
  const account=await requireActiveProfile(["admin","facilitator"]);if(account.error||!account.profile)return account.error;
  ensureAiTables();const body=await request.json() as {title?:string;interactive?:unknown};const interactive=normalizeInteractive(body.interactive);const issues=interactiveIssues(interactive);
  if(issues.length||!body.title?.trim())return Response.json({error:issues.join(" ")||"Provide a title."},{status:400});
  const count=await getRawDb().prepare("SELECT COUNT(*) n FROM course_activity_library WHERE owner_email=?").bind(account.profile.email).first<{n:number}>();
  if((count?.n||0)>=100)return Response.json({error:"Your activity library is full. Delete an unused template first."},{status:409});
  const id=crypto.randomUUID();await getRawDb().prepare("INSERT INTO course_activity_library(id,owner_email,title,activity_json) VALUES(?,?,?,?)").bind(id,account.profile.email,body.title.trim().slice(0,240),JSON.stringify(interactive)).run();
  return Response.json({id},{status:201});
}
export async function DELETE(request:Request) {
  const origin=rejectCrossSiteMutation(request);if(origin)return origin;
  const account=await requireActiveProfile(["admin","facilitator"]);if(account.error||!account.profile)return account.error;
  ensureAiTables();const body=await request.json() as {id?:string};await getRawDb().prepare("DELETE FROM course_activity_library WHERE id=? AND owner_email=?").bind(String(body.id||""),account.profile.email).run();return Response.json({ok:true});
}
