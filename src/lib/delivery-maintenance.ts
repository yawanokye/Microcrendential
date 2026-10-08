import { getRawDb } from "@/db/raw";
import { notify, deliverNotificationEmails } from "./delivery-notifications";
import { processGradingJobs } from "./grading-workflow";
import { enrolledCourse, parseRecord } from "./course-access";
import { normalizeCourseDesign } from "./course-design";
import { processEvidenceJobs } from "./evidence-workflow";

export async function deliveryMaintenance() {
  const processed=await processGradingJobs()+await processEvidenceJobs(),db=getRawDb(),now=Date.now();
  const sessions=await db.prepare("SELECT s.*,e.user_email FROM delivery_sessions s JOIN enrollments e ON e.course_code=s.course_code AND e.status='active' WHERE s.cancelled=0 AND datetime(s.starts_at)>datetime('now') AND datetime(s.starts_at)<=datetime('now','+15 minutes') LIMIT 500").all<{id:number;user_email:string;title:string;starts_at:string;course_code:string}>();
  for(const row of sessions.results)await notify(row.user_email,`reminder-session-${row.id}-${row.starts_at}`,"session","Your live session starts soon",`${row.title} starts at ${row.starts_at}.`,`/?view=live`);
  const enrolments=await db.prepare("SELECT e.user_email,e.course_code FROM enrollments e JOIN notification_preferences p ON p.user_email=e.user_email WHERE e.status='active' AND (p.assessment_reminders=1 OR p.weekly_digest=1) ORDER BY e.id").all<{user_email:string;course_code:string}>();
  for(const row of enrolments.results) {
    const course=await enrolledCourse(row.user_email,row.course_code);if(!course)continue;
    const design=normalizeCourseDesign(parseRecord(course.design_json,{})),due=Date.parse(design.delivery.assessmentDueAt);
    if(due>now&&due<=now+48*60*60*1000)await notify(row.user_email,`due-${row.course_code}-${design.delivery.assessmentDueAt}`,"assessment","Assessment deadline approaching",`${course.title}: ${design.delivery.assessmentDueAt}`,`/learn/${encodeURIComponent(row.course_code)}`);
    if(new Date().getUTCDay()===1)await notify(row.user_email,`digest-${row.course_code}-${new Date().toISOString().slice(0,10)}`,"digest","Continue your learning this week",`Your enrolment in ${course.title} is available. Open your saved lessons and feedback in the learner portal.`,`/learn/${encodeURIComponent(row.course_code)}`);
  }
  if(new Date().getUTCDay()===1) {
    const staff=await db.prepare("SELECT u.email,u.role FROM users u JOIN notification_preferences p ON p.user_email=u.email WHERE u.role IN ('facilitator','admin') AND u.status='active' AND p.weekly_digest=1").all<{email:string;role:string}>();
    for(const person of staff.results) {
      const pending=await db.prepare("SELECT COUNT(*) count FROM assessment_submissions s JOIN course_drafts c ON c.code=s.course_code WHERE s.status IN ('submitted','awaiting_marking') AND (?='admin' OR c.created_by_email=? OR EXISTS(SELECT 1 FROM course_team t WHERE t.course_code=c.code AND t.user_email=?))").bind(person.role,person.email,person.email).first<{count:number}>();
      await notify(person.email,`staff-digest-${new Date().toISOString().slice(0,10)}`,"digest","Weekly teaching and operations digest",`${pending?.count??0} final assessment submissions are awaiting processing or marking. Open the teaching priorities and support queues for the current records.`,"/?view=overview");
    }
  }
  await deliverNotificationEmails();
  return {processed};
}
