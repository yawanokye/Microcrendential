import { publicCatalogue } from "@/lib/public-catalogue";

export async function GET(request:Request){
  return Response.json(publicCatalogue(new URL(request.url).searchParams),{headers:{"cache-control":"no-store"}});
}
