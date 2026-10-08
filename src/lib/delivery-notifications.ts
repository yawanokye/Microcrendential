import { getRawDb } from "@/db/raw";
import { sendTransactionalEmail } from "./email";

export async function notify(email:string,key:string,category:string,title:string,message:string,link="/") {
  await getRawDb().prepare("INSERT OR IGNORE INTO delivery_notifications(user_email,dedupe_key,category,title,message,link) VALUES(?,?,?,?,?,?)").bind(email,key,category,title,message,link.startsWith("/") ? link : "/").run();
}
export async function notifyCourse(code:string,key:string,category:string,title:string,message:string) {
  const rows=await getRawDb().prepare("SELECT user_email FROM enrollments WHERE course_code=? AND status IN ('active','completed')").bind(code).all<{user_email:string}>();
  for(const row of rows.results) await notify(row.user_email,key,category,title,message,`/learn/${encodeURIComponent(code)}`);
}
export async function notifyTeachers(code:string,key:string,title:string,message:string) {
  const rows=await getRawDb().prepare("SELECT created_by_email email FROM course_drafts WHERE code=? UNION SELECT user_email email FROM course_team WHERE course_code=?").bind(code,code).all<{email:string}>();
  for(const row of rows.results) await notify(row.email,key,"teaching",title,message,"/?view=delivery");
}
export async function deliverNotificationEmails() {
  const db=getRawDb();
  const rows=await db.prepare(`SELECT n.* FROM delivery_notifications n JOIN notification_preferences p ON p.user_email=n.user_email WHERE n.email_status='pending' AND p.email_enabled=1 AND ((n.category='assessment' AND p.assessment_reminders=1) OR (n.category='session' AND p.session_reminders=1) OR (n.category='teaching' AND p.teaching_alerts=1) OR (n.category='digest' AND p.weekly_digest=1) OR n.category IN ('support','announcement','payment')) ORDER BY n.id LIMIT 10`).all<{id:number;user_email:string;title:string;message:string}>();
  for(const row of rows.results) {
    const claimed=await db.prepare("UPDATE delivery_notifications SET email_status='sending' WHERE id=? AND email_status='pending'").bind(row.id).run();
    if(!claimed.meta.changes)continue;
    try { await sendTransactionalEmail({to:row.user_email,subject:row.title,heading:row.title,text:row.message}); await db.prepare("UPDATE delivery_notifications SET email_status='sent' WHERE id=?").bind(row.id).run(); }
    catch { await db.prepare("UPDATE delivery_notifications SET email_status='failed' WHERE id=?").bind(row.id).run(); }
  }
}
