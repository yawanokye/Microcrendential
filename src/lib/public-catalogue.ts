import { getRawDb } from "@/db/raw";
import { normalizeCourseDesign, type CourseMaterialRecord } from "@/lib/course-design";
import { audienceAllowedNative, audienceSql, courseDiscoverySql } from "@/lib/catalogue-access";
import { currentBillingNative } from "@/lib/learning-billing";
import { offeringRoute } from "@/lib/learning-discovery";
import { programmeConfig, type ProgrammeRow } from "@/lib/programmes";

const parse=<T,>(value:string,fallback:T):T=>{try{return JSON.parse(value||"") as T;}catch{return fallback;}};
type Key={kind:"course"|"programme";id:number};
type CourseRow={id:number;code:string;title:string;discipline:string;description:string;design_json:string;materials_json:string;activities_json:string;certificate_enabled:number;activated_at:string|null;facilitator_name:string|null};
const routes=["microcredential","cpd","certificate","degree"] as const;

/** Search and paginate the public catalogue before loading detailed course records. */
export function publicCatalogue(params:URLSearchParams){
  const courseAudience=courseDiscoverySql("c.code"),programmeAudience=audienceSql("programme","p.code");
  const cte=`WITH offerings AS (
    SELECT 'course' kind,c.id,c.code,c.title,c.discipline,c.description,
      COALESCE(json_extract(c.design_json,'$.certificate.awardType'),'microcredential_achievement') award,
      COALESCE(json_extract(c.design_json,'$.certificate.partnerName'),'') partner,
      lower(c.code||' '||c.title||' '||c.discipline||' '||c.description||' '||COALESCE(json_extract(c.design_json,'$.outcomes'),'')) search_text,
      COALESCE(c.activated_at,c.created_at) published_at
    FROM course_drafts c WHERE c.status='active' AND ${courseAudience.sql}
    UNION ALL
    SELECT 'programme',p.id,p.code,p.title,COALESCE(NULLIF(json_extract(p.config_json,'$.academicUnit'),''),'Full programmes'),
      COALESCE(json_extract(p.config_json,'$.description'),''),COALESCE(json_extract(p.config_json,'$.award'),'certificate'),'',
      lower(p.code||' '||p.title||' '||COALESCE(json_extract(p.config_json,'$.academicUnit'),'')||' '||COALESCE(json_extract(p.config_json,'$.description'),'')||' '||COALESCE(json_extract(p.config_json,'$.qualificationTitle'),'')),
      COALESCE(p.updated_at,p.created_at) FROM academic_programmes p WHERE p.status='active' AND ${programmeAudience.sql}
  )`;
  const query=String(params.get("q")||"").trim().toLowerCase().slice(0,180).replace(/[%_\\]/g," ");
  const route=String(params.get("type")||"").slice(0,30),subject=String(params.get("subject")||"").slice(0,240),award=String(params.get("award")||"").slice(0,80),provider=String(params.get("provider")||"").slice(0,240),offering=String(params.get("offering")||"").slice(0,200);
  const page=Math.min(10000,Math.max(1,Math.floor(Number(params.get("page"))||1))),pageSize=Math.min(100,Math.max(1,Math.floor(Number(params.get("limit"))||100)));
  const where:string[]=[], values:(string|number)[]=[];
  const routeExpr="CASE WHEN kind='programme' THEN CASE WHEN award IN ('bachelors','masters','doctorate') THEN 'degree' ELSE 'certificate' END WHEN award LIKE 'cpd_%' THEN 'cpd' ELSE 'microcredential' END";
  if(route){where.push(`${routeExpr}=?`);values.push(route);}
  if(subject){where.push("discipline=?");values.push(subject);}
  if(award){where.push("award=?");values.push(award);}
  if(provider&&provider!=="University of Cape Coast"){where.push("partner=?");values.push(provider);}
  if(offering){const i=offering.indexOf(":");where.push("kind=? AND code=?");values.push(i<0?"":offering.slice(0,i),i<0?"":offering.slice(i+1));}
  const synonyms:Record<string,string[]>={"artificial intelligence":["artificial intelligence","machine learning","generative ai"," ai "],"data science":["data science","data analysis","data analytics","statistics"],"coding":["coding","programming","python","javascript","software development"],"cybersecurity":["cybersecurity","cyber security","information security"]};
  if(query){const related=synonyms[query];if(related){where.push("("+related.map(()=>"search_text LIKE ?").join(" OR ")+")");values.push(...related.map(term=>`%${term}%`));}else for(const term of query.split(/\s+/).filter(Boolean).slice(0,20)){where.push("search_text LIKE ?");values.push(`%${term}%`);}}
  const clause=where.length?" WHERE "+where.join(" AND "):"";
  return getRawDb().read(db=>{
    const allFacets=db.prepare(`${cte} SELECT kind,award,discipline,partner,COUNT(*) n FROM offerings GROUP BY kind,award,discipline,partner`).all(...courseAudience.values,...programmeAudience.values) as {kind:string;award:string;discipline:string;partner:string;n:number}[];
    const counts:Record<string,number>=Object.fromEntries(routes.map(r=>[r,0])),subjects=new Set<string>(),providers=new Set<string>();
    for(const item of allFacets){counts[offeringRoute(item.kind,item.award)]+=item.n;if(item.discipline)subjects.add(item.discipline);if(item.partner)providers.add(item.partner);}
    const baseValues=[...courseAudience.values,...programmeAudience.values,...values];
    const total=Number((db.prepare(`${cte} SELECT COUNT(*) n FROM offerings${clause}`).get(...baseValues) as {n:number}).n);
    const keys=db.prepare(`${cte} SELECT kind,id FROM offerings${clause} ORDER BY published_at DESC,kind,id DESC LIMIT ? OFFSET ?`).all(...baseValues,pageSize,(page-1)*pageSize) as Key[];
    const courses=keys.flatMap<unknown>(key=>{
      if(key.kind==="course"){
        const row=db.prepare(`SELECT c.id,c.code,c.title,c.discipline,c.description,c.design_json,c.materials_json,c.activities_json,c.certificate_enabled,c.activated_at,u.full_name facilitator_name FROM course_drafts c LEFT JOIN users u ON u.email=c.created_by_email WHERE c.id=? AND c.status='active' AND ${courseAudience.sql}`).get(key.id,...courseAudience.values) as CourseRow|undefined;
        if(!row)return [];
        const design=normalizeCourseDesign(parse(row.design_json,{})),billing=currentBillingNative(db,"course",row.code);
        if(design.broaderCredentialCode&&!audienceAllowedNative(db,"course",design.broaderCredentialCode)){design.broaderCredentialCode="";design.broaderCredentialTitle="";design.broaderCredentialRequiredCodes=[];}
        return [{kind:"course" as const,route:offeringRoute("course",design.certificate.awardType),id:row.id,code:row.code,title:row.title,discipline:row.discipline,description:row.description,design:{...design,priceGhs:billing.enrollmentPesewas/100,certificateFeeGhs:billing.certificatePesewas/100},billing,materials:parse<CourseMaterialRecord[]>(row.materials_json,[]).map(m=>({id:m.id,title:m.title,kind:m.kind,sectionId:m.sectionId,sectionTitle:m.sectionTitle,unitTitle:m.unitTitle,estimatedMinutes:m.estimatedMinutes,outcomeIds:m.outcomeIds,required:m.required})),activities:parse<Record<string,unknown>[]>(row.activities_json,[]).map(a=>({id:a.id,kind:a.kind,title:a.title,required:a.required,passMark:a.passMark})),certificateEnabled:Boolean(row.certificate_enabled),activatedAt:row.activated_at,facilitatorName:row.facilitator_name||"University of Cape Coast"}];
      }
      const row=db.prepare(`SELECT p.* FROM academic_programmes p WHERE p.id=? AND p.status='active' AND ${programmeAudience.sql}`).get(key.id,...programmeAudience.values) as ProgrammeRow|undefined;
      if(!row)return [];
      const c=programmeConfig(row),billing=currentBillingNative(db,"programme",row.code);
      return [{kind:"programme" as const,route:offeringRoute("programme",c.award),id:row.id,code:row.code,title:row.title,discipline:c.academicUnit||"Full programmes",description:c.description,duration:c.duration,entryRequirements:c.entryRequirements,qualificationTitle:c.qualificationTitle,termCount:c.terms.length,credits:c.minimumCredits,design:{certificate:{awardType:c.award},outcomes:[],priceGhs:billing.enrollmentPesewas/100,certificateFeeGhs:billing.certificatePesewas/100,deliveryPattern:c.delivery,level:c.award},billing,facilitatorName:"University of Cape Coast",materials:[],activities:[]}];
    });
    return {courses,routes,page,pageSize,total,hasMore:page*pageSize<total,summary:{counts,subjects:[...subjects].sort(),providers:[...providers].sort()}};
  });
}
