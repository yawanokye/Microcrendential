import {requireActiveProfile} from "@/lib/accounts";
import {rejectCrossSiteMutation} from "@/lib/request-security";
import {programmePayload} from "@/lib/programme-http";
import {libraryData,libraryMutation,searchLibrary,LibraryError} from "@/lib/open-library";
export const dynamic='force-dynamic';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
const failure=(e:unknown)=>json({error:e instanceof LibraryError||e instanceof Error?e.message:'Library request failed.'},e instanceof LibraryError?e.status:400);
export async function GET(){const a=await requireActiveProfile();if(a.error||!a.profile)return a.error;try{return json(await libraryData(a.profile));}catch(e){return failure(e);}}
export async function POST(request:Request){const origin=rejectCrossSiteMutation(request);if(origin)return origin;const a=await requireActiveProfile();if(a.error||!a.profile)return a.error;try{const p=await programmePayload(request);if(p.action==='search')return json(await searchLibrary(a.profile,String(p.query||''),String(p.year||''),String(p.type||'')));await libraryMutation(a.profile,p);return json({ok:true});}catch(e){return failure(e);}}
