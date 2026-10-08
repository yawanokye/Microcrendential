import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { requireActiveProfile } from "@/lib/accounts";
import { getRawDb } from "@/db/raw";
export async function GET(request:Request) {
  const account=await requireActiveProfile();if(account.error||!account.profile)return account.error;
  const reference=new URL(request.url).searchParams.get("reference")||"",row=await getRawDb().prepare("SELECT o.*,c.title FROM payment_orders o LEFT JOIN course_drafts c ON c.code=o.course_code WHERE o.reference=? AND o.status='paid' AND (o.user_email=? OR ?='admin')").bind(reference,account.profile.email,account.profile.role).first<{reference:string;title:string;course_code:string;user_email:string;amount_pesewas:number;currency:string;purpose:string;paid_at:string}>();
  if(!row)return Response.json({error:"Paid receipt not found."},{status:404});
  const pdf=await PDFDocument.create(),page=pdf.addPage([595,842]),font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const lines=["UNIVERSITY OF CAPE COAST","UCC Growth+ payment receipt",`Receipt: ${row.reference}`,`Learner: ${row.user_email}`,`Course code: ${row.course_code}`,`Course: ${row.title}`,`Purpose: ${row.purpose}`,`Amount paid: ${row.currency} ${(row.amount_pesewas/100).toFixed(2)}`,`Paid: ${row.paid_at}`,"Status: Provider-verified payment received", "Learner fees are received by UCC. Anovlad usage charges are separate."];
  lines.forEach((line,i)=>{const safe=line.replace(/[^\x20-\x7e]/g,"?");const size=i<2?18:11;let text=safe;while(font.widthOfTextAtSize(text,size)>490)text=text.slice(0,-1);page.drawText(text,{x:50,y:770-i*38,size,font:i<2?bold:font,color:rgb(.1,.15,.3)});});
  return new Response(Buffer.from(await pdf.save()),{headers:{"content-type":"application/pdf","content-disposition":`attachment; filename="${row.reference.replace(/[^A-Za-z0-9_-]/g,"_")}.pdf"`,"cache-control":"private, no-store"}});
}
