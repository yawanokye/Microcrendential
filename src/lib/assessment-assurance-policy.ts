/** Facilitator-selected controls. Missing fields always mean disabled. */
export type AssurancePolicy = {
  enabled: boolean; employerRoster: boolean; identityReview: boolean; webcamCheckpoints: boolean;
  randomizeQuestions: boolean; randomizeOptions: boolean; timedAssessment: boolean; timeLimitMinutes: number;
  monitorFocus: boolean; practicalTask: boolean; practicalInstructions: string; practicalRubric: string; practicalPassMark: number;
  oralCheck: boolean; oralInstructions: string; humanReview: boolean; competencyChecks: boolean;
  competencies: { outcomeId: string; passMark: number }[]; checkpointMinutes: number; retentionDays: number; allowedResources: string;
};
export const defaultAssurancePolicy = (): AssurancePolicy => ({ enabled:false,employerRoster:false,identityReview:false,webcamCheckpoints:false,randomizeQuestions:false,randomizeOptions:false,timedAssessment:false,timeLimitMinutes:30,monitorFocus:false,practicalTask:false,practicalInstructions:"",practicalRubric:"",practicalPassMark:60,oralCheck:false,oralInstructions:"Explain your approach and answer the facilitator’s follow-up questions during the arranged verification meeting.",humanReview:false,competencyChecks:false,competencies:[],checkpointMinutes:10,retentionDays:30,allowedResources:"Follow the facilitator’s stated rules for reference materials, collaboration and AI use." });
const number=(v:unknown,min:number,max:number,fallback:number)=>Math.min(max,Math.max(min,Number.isFinite(Number(v))?Number(v):fallback));
export function normalizeAssurancePolicy(value:unknown):AssurancePolicy {
  const input=value&&typeof value==="object"?value as Partial<AssurancePolicy>:{},fallback=defaultAssurancePolicy();
  const flags=["enabled","employerRoster","identityReview","webcamCheckpoints","randomizeQuestions","randomizeOptions","timedAssessment","monitorFocus","practicalTask","oralCheck","humanReview","competencyChecks"] as const;
  return {...fallback,...Object.fromEntries(flags.map(k=>[k,input[k]===true])),timeLimitMinutes:Math.round(number(input.timeLimitMinutes,1,240,30)),checkpointMinutes:Math.round(number(input.checkpointMinutes,2,30,10)),retentionDays:Math.round(number(input.retentionDays,1,90,30)),practicalPassMark:number(input.practicalPassMark,1,100,60),practicalInstructions:String(input.practicalInstructions||"").trim().slice(0,6000),practicalRubric:String(input.practicalRubric||"").trim().slice(0,6000),oralInstructions:String(input.oralInstructions||fallback.oralInstructions).trim().slice(0,3000),allowedResources:String(input.allowedResources||fallback.allowedResources).trim().slice(0,3000),competencies:Array.isArray(input.competencies)?[...new Map(input.competencies.slice(0,20).filter(c=>c&&typeof c==="object").map(c=>[String(c.outcomeId||"").slice(0,80),{outcomeId:String(c.outcomeId||"").slice(0,80),passMark:number(c.passMark,1,100,60)}])).values()].filter(c=>c.outcomeId):[]};
}
export function assuranceIssues(policy:AssurancePolicy,outcomeIds:string[]) {
  if(!policy.enabled)return [];
  return [...(policy.practicalTask&&(!policy.practicalInstructions||policy.practicalRubric.length<20)?["Add workplace-task instructions and an approved marking rubric."]:[]),...(policy.competencyChecks&&(!policy.competencies.length||policy.competencies.some(c=>!outcomeIds.includes(c.outcomeId)))?["Choose valid learning outcomes for the competency checks."]:[])];
}

export function assuranceEnabled(policy:AssurancePolicy){return policy.enabled&&[policy.employerRoster,policy.identityReview,policy.webcamCheckpoints,policy.randomizeQuestions,policy.randomizeOptions,policy.timedAssessment,policy.monitorFocus,policy.practicalTask,policy.oralCheck,policy.humanReview,policy.competencyChecks].some(Boolean);}
