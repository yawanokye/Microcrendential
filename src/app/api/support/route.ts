import { requireActiveProfile } from "@/lib/accounts";
import { recordAudit } from "@/lib/audit";
import { sendTransactionalEmail } from "@/lib/email";
import { getRawDb } from "@/db/raw";
import { rejectCrossSiteMutation } from "@/lib/request-security";
import { notify } from "@/lib/delivery-notifications";

export async function GET(request:Request) {
  const account=await requireActiveProfile();if(account.error||!account.profile)return account.error;
  const before=Number(new URL(request.url).searchParams.get("before"))||Number.MAX_SAFE_INTEGER,db=getRawDb();
  const rows=await db.prepare("SELECT * FROM support_requests WHERE (?='admin' OR requester_email=?) AND id<? ORDER BY id DESC LIMIT 51").bind(account.profile.role,account.profile.email,before).all<{id:number}>();
  const tickets=[];for(const row of rows.results.slice(0,50))tickets.push({...row,reference:`UGP-${String(row.id).padStart(6,"0")}`,replies:(await db.prepare("SELECT r.*,u.full_name author_name FROM support_replies r LEFT JOIN users u ON u.email=r.author_email WHERE request_id=? ORDER BY r.id").bind(row.id).all()).results});
  return Response.json({tickets,nextCursor:rows.results.length>50?rows.results[49].id:null,responseTarget:"UCC aims to acknowledge requests within two working days. This is a service target; urgent access issues should also use the published support contact."});
}
export async function PATCH(request:Request) {
  const origin=rejectCrossSiteMutation(request);if(origin)return origin;
  const account=await requireActiveProfile();if(account.error||!account.profile)return account.error;
  const p=await request.json() as {id?:number;message?:string;status?:string},db=getRawDb(),ticket=await db.prepare("SELECT requester_email FROM support_requests WHERE id=?").bind(Number(p.id)).first<{requester_email:string}>();
  if(!ticket||(account.profile.role!=="admin"&&ticket.requester_email!==account.profile.email))return Response.json({error:"Support request not found."},{status:404});
  const message=String(p.message||"").trim().slice(0,5000);if(message.length<3)return Response.json({error:"Enter a reply."},{status:400});
  const status=account.profile.role==="admin"&&["open","in_progress","resolved","closed"].includes(p.status||"")?p.status:"open";
  await db.prepare("INSERT INTO support_replies(request_id,author_email,message) VALUES(?,?,?)").bind(Number(p.id),account.profile.email,message).run();
  await db.prepare("UPDATE support_requests SET status=?,updated_at=CURRENT_TIMESTAMP,resolved_at=CASE WHEN ? IN ('resolved','closed') THEN CURRENT_TIMESTAMP ELSE NULL END WHERE id=?").bind(status,status,Number(p.id)).run();
  if(account.profile.role==="admin")await notify(ticket.requester_email,`support-${p.id}-${Date.now()}`,"support","Support reply available",message,"/?view=support");
  await recordAudit(account.profile.email,"support.replied",{requestId:p.id,status});
  return Response.json({saved:true});
}

export async function POST(request: Request) {
  const origin = rejectCrossSiteMutation(request);
  if (origin) return origin;
  const account = await requireActiveProfile();
  if (account.error || !account.profile) return account.error;
  const payload = await request.json() as { category?: string; message?: string };
  const category = payload.category?.trim().slice(0, 80) ?? "";
  const message = payload.message?.trim().slice(0, 5000) ?? "";
  if (!category || message.length < 10) return Response.json({ error: "Choose a category and describe the issue in at least 10 characters." }, { status: 400 });
  const created = await getRawDb().prepare("INSERT INTO support_requests (requester_email,requester_role,category,message) VALUES (?,?,?,?)")
    .bind(account.profile.email, account.profile.role, category, message).run();
  const reference = `UGP-${String(created.meta.last_row_id).padStart(6, "0")}`;
  await recordAudit(account.profile.email, "support.requested", { reference, category });
  const supportEmail = process.env.SUPPORT_EMAIL?.trim();
  let notified = false;
  if (supportEmail) {
    try {
      await sendTransactionalEmail({ to: supportEmail, subject: `[${reference}] UCC Growth+ support request`, heading: "New platform support request", text: `Reference: ${reference}\nRequester: ${account.profile.full_name} (${account.profile.email})\nRole: ${account.profile.role}\nCategory: ${category}\n\n${message}` });
      notified = true;
    } catch (error) { console.error("Support notification email failed", error); }
  }
  return Response.json({ submitted: true, reference, notified }, { status: 201 });
}
