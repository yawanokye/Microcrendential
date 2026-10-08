import { createHmac, timingSafeEqual } from "node:crypto";
import { deliveryMaintenance } from "@/lib/delivery-maintenance";
export async function POST(request:Request) {
  if(!process.env.AUTH_SECRET)return Response.json({error:"Maintenance authentication is unavailable."},{status:503});
  const expected=createHmac("sha256",process.env.AUTH_SECRET).update("ucc-delivery-worker-v1").digest("hex"),supplied=request.headers.get("authorization")?.replace(/^Bearer /,"")??"";
  if(supplied.length!==expected.length||!timingSafeEqual(Buffer.from(expected),Buffer.from(supplied)))return Response.json({error:"Unauthorised."},{status:401});
  return Response.json(await deliveryMaintenance());
}
