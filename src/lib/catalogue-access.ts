import type { DatabaseSync } from "node:sqlite";
import { getRawDb } from "@/db/raw";
import type { OfferingKind } from "./catalogue-policy";

export type CatalogueActor = { email: string; role: "learner" | "facilitator" | "admin" };
const memberSql = "m.status='active' AND g.status='active' AND o.status='active' AND (m.expires_at IS NULL OR julianday(m.expires_at)>julianday('now'))";
export function audienceSql(kind: OfferingKind, code: string, actor?: CatalogueActor | null): { sql: string; values: string[] } {
  if (actor?.role === "admin") return { sql: "1=1", values: [] };
  let sql = "NOT EXISTS(SELECT 1 FROM offering_access a WHERE a.offering_kind='" + kind + "' AND a.offering_code=" + code + " AND a.visibility='private')";
  const values: string[] = [];
  if (actor) { sql += " OR EXISTS(SELECT 1 FROM offering_access_groups ag JOIN learning_group_members m ON m.group_id=ag.group_id JOIN learning_access_groups g ON g.id=m.group_id JOIN learning_organisations o ON o.id=g.organisation_id WHERE ag.offering_kind='" + kind + "' AND ag.offering_code=" + code + " AND m.user_email=? AND " + memberSql + ")"; values.push(actor.email); }
  if (actor?.role === "facilitator") {
    if (kind === "course") { sql += " OR EXISTS(SELECT 1 FROM course_drafts own WHERE own.code=" + code + " AND own.created_by_email=?) OR EXISTS(SELECT 1 FROM course_team t WHERE t.course_code=" + code + " AND t.user_email=?)"; values.push(actor.email, actor.email); }
    else { sql += " OR EXISTS(SELECT 1 FROM academic_programmes own WHERE own.code=" + code + " AND own.created_by_email=?)"; values.push(actor.email); }
  }
  return { sql: "(" + sql + ")", values };
}
export function courseDiscoverySql(code: string, actor?: CatalogueActor | null) {
  const own = audienceSql("course", code, actor), parent = audienceSql("programme", "p.code", actor);
  // Programme-only modules inherit their programme audience. Public catalogues
  // list the qualification instead of separately advertising its modules.
  if (!actor) return { sql: own.sql + " AND COALESCE(json_extract(c.design_json,'$.enrolmentMode'),'open')<>'programme'", values: own.values };
  if (actor.role !== "learner") return own;
  const inherited = "COALESCE(json_extract(c.design_json,'$.enrolmentMode'),'open')<>'programme' OR EXISTS(SELECT 1 FROM academic_programmes p, json_each(p.config_json,'$.courses') j WHERE json_extract(j.value,'$.code')=" + code + " AND p.status IN ('active','superseded','closed') AND " + parent.sql + ") OR EXISTS(SELECT 1 FROM enrollments old WHERE old.course_code=" + code + " AND old.user_email=? AND json_valid(old.course_snapshot_json) AND COALESCE(json_extract(json_extract(old.course_snapshot_json,'$.design_json'),'$.enrolmentMode'),'open')<>'programme')";
  return { sql: own.sql + " AND (" + inherited + ")", values: [...own.values, ...parent.values, actor.email] };
}
export function audienceAllowedNative(db: DatabaseSync, kind: OfferingKind, code: string, actor?: CatalogueActor | null) {
  const p = audienceSql(kind, "target.code", actor);
  return Boolean(db.prepare("SELECT 1 ok FROM (SELECT ? code) target WHERE " + p.sql).get(code, ...p.values));
}
export function audienceAllowed(kind: OfferingKind, code: string, actor?: CatalogueActor | null) { return getRawDb().read(db => audienceAllowedNative(db, kind, code, actor)); }
export function isPrivateOffering(kind: OfferingKind, code: string) { return getRawDb().read(db => {
  if(db.prepare("SELECT 1 FROM offering_access WHERE offering_kind=? AND offering_code=? AND visibility='private'").get(kind,code))return true;
  if(kind!=="course")return false;
  const programmeModule=db.prepare("SELECT 1 FROM course_drafts WHERE code=? AND json_extract(design_json,'$.enrolmentMode')='programme'").get(code);if(!programmeModule)return false;
  const parent=audienceSql("programme","p.code");return !db.prepare("SELECT 1 FROM academic_programmes p,json_each(p.config_json,'$.courses') j WHERE json_extract(j.value,'$.code')=? AND p.status IN ('active','superseded','closed') AND "+parent.sql+" LIMIT 1").get(code,...parent.values);
}); }
export function activeGroupsNative(db: DatabaseSync, email: string, authorOnly = false) { return db.prepare("SELECT g.id,g.name,o.id organisation_id,o.name organisation_name,m.reference,m.expires_at,m.can_author FROM learning_group_members m JOIN learning_access_groups g ON g.id=m.group_id JOIN learning_organisations o ON o.id=g.organisation_id WHERE m.user_email=? AND " + memberSql + (authorOnly ? " AND m.can_author=1" : "") + " ORDER BY o.name,g.name").all(email) as {id:number;name:string;organisation_id:number;organisation_name:string;reference:string;expires_at:string|null;can_author:number}[]; }
export function catalogueAudit(db: DatabaseSync, actor: CatalogueActor, action: string, details: object) { db.prepare("INSERT INTO admin_audit_log(admin_email,action,details_json) VALUES(?,?,?)").run(actor.email, "catalogue." + action, JSON.stringify(details)); }
export function offeringOwnerNative(db: DatabaseSync, kind: OfferingKind, code: string) { return db.prepare(kind === "course" ? "SELECT created_by_email FROM course_drafts WHERE code=? LIMIT 1" : "SELECT created_by_email FROM academic_programmes WHERE code=? ORDER BY version DESC LIMIT 1").get(code) as {created_by_email:string}|undefined; }
export function policyGroupsNative(db: DatabaseSync, kind: OfferingKind, code: string) { return (db.prepare("SELECT group_id FROM offering_access_groups WHERE offering_kind=? AND offering_code=?").all(kind, code) as {group_id:number}[]).map(x => x.group_id); }
export function audienceCompatibilityNative(db: DatabaseSync, parentKind: OfferingKind, parentCode: string, components: string[], proposed?: { visibility: "public" | "private"; groups: number[] }) {
  const access = proposed || { visibility: db.prepare("SELECT visibility FROM offering_access WHERE offering_kind=? AND offering_code=?").get(parentKind, parentCode) ? "private" as const : "public" as const, groups: policyGroupsNative(db, parentKind, parentCode) };
  if (!proposed) { const row = db.prepare("SELECT visibility FROM offering_access WHERE offering_kind=? AND offering_code=?").get(parentKind, parentCode) as {visibility:"public"|"private"}|undefined; access.visibility = row?.visibility || "public"; }
  for (const code of components) {
    const row = db.prepare("SELECT visibility FROM offering_access WHERE offering_kind='course' AND offering_code=?").get(code) as {visibility:string}|undefined;
    if (row?.visibility !== "private") continue;
    const groups = policyGroupsNative(db, "course", code);
    if (access.visibility === "public" || access.groups.some(id => !groups.includes(id))) return "The programme or pathway audience must be eligible for every restricted component. Review the audience for " + code + ".";
  }
  return "";
}
export function copyOfferingPoliciesNative(db:DatabaseSync,source:string,target:string,actor:CatalogueActor){
 db.prepare("INSERT INTO offering_access(offering_kind,offering_code,visibility,updated_by) SELECT offering_kind,?,visibility,? FROM offering_access WHERE offering_kind='course' AND offering_code=?").run(target,actor.email,source);
 db.prepare("INSERT INTO offering_access_groups(offering_kind,offering_code,group_id) SELECT offering_kind,?,group_id FROM offering_access_groups WHERE offering_kind='course' AND offering_code=?").run(target,source);
 db.prepare("INSERT INTO offering_billing(offering_kind,offering_code,enrollment_pesewas,certificate_pesewas,enrollment_payer,certificate_payer,includes_course_fees,updated_by) SELECT offering_kind,?,enrollment_pesewas,certificate_pesewas,enrollment_payer,certificate_payer,includes_course_fees,? FROM offering_billing WHERE offering_kind='course' AND offering_code=?").run(target,actor.email,source);
}
