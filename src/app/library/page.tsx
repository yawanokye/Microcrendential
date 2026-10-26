import {redirect} from "next/navigation";
import {requireActiveProfile} from "@/lib/accounts";
import {OpenLibrary} from "@/components/open-library";
export const dynamic='force-dynamic';
export const metadata={title:'Open Access Library · UCC Growth+',robots:{index:false,follow:false}};
export default async function LibraryPage(){const a=await requireActiveProfile();if(a.error||!a.profile)redirect('/student-signin');return <OpenLibrary role={a.profile.role} name={a.profile.full_name}/>;}
