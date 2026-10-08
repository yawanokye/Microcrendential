import { getRawDb } from "../src/db/raw";
import { defaultCourseDesign } from "../src/lib/course-design";
import { enrolWithSnapshot } from "../src/lib/course-access";
import { putStoredFile } from "../src/lib/render-storage";
import sharp from "sharp";
if(!process.env.DATA_DIR?.includes("ucc-browser-test-")||!process.env.SQLITE_PATH?.startsWith(process.env.DATA_DIR))throw new Error("Use an isolated browser-test directory.");
const db=getRawDb();
const signatureBytes=new Uint8Array(await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="60"><rect width="240" height="60" fill="white"/><text x="10" y="40" font-size="25" fill="black">TEST SIGNATURE</text></svg>')).png().toBuffer());
for(const [key,role,email] of [["provost","provost","admin@example.test"],["facilitator:owner@example.test","facilitator","owner@example.test"]]) {
  const fileKey=await putStoredFile("certificate-signatures/test",new File([signatureBytes],"test-signature.png",{type:"image/png"}),{contentType:"image/png",originalName:"test-signature.png",ownerEmail:email});
  await db.prepare("INSERT INTO certificate_signatures(signature_key,role,owner_email,signatory_name,signatory_title,file_key,file_name,mime_type,uploaded_by_email) VALUES(?,?,?,?,?,?,?,'image/png',?)").bind(key,role,email,"Test signatory","Acceptance test only",fileKey,"test-signature.png",email).run();
}
for(const [name,role] of [["learner","learner"],["owner","facilitator"],["marker","facilitator"],["moderator","facilitator"],["outsider","facilitator"],["admin","admin"]]){
  const email=`${name}@example.test`;
  await db.prepare("INSERT INTO auth_accounts(email,full_name,password_hash,password_salt,email_verified_at) VALUES(?,?, 'not-a-password','test-only',CURRENT_TIMESTAMP)").bind(email,`Test ${name}`).run();
  await db.prepare("INSERT INTO users(email,full_name,role,status,identity_status,is_test_record) VALUES(?,?,?,'active','verified',1)").bind(email,`Test ${name}`,role).run();
}
const design=defaultCourseDesign();design.delivery.markingMode="human";design.delivery.assessmentDueAt="2099-01-01T00:00:00Z";design.certificate.showAcademicLead=true;
const material={id:"lesson-one",title:"Working with professional evidence",kind:"Read",source:"Course author",sectionId:"section-1",required:true,readableHtml:"<h2>Evidence and judgement</h2><p>Work through this lesson and explain how evidence supports a responsible professional decision.</p>",accessibilityChecked:true};
const activity={id:"inline-one",kind:"inline",materialId:material.id,sectionId:"section-1",title:"Explain a professional decision",instructions:"Use evidence to explain a decision in your workplace.",required:true,gradingMode:"facilitator",responseType:"long_text",rubric:"Evidence accuracy: 50 marks; explanation of the professional decision: 50 marks.",maxMark:100,passMark:60,attemptsAllowed:3};
await db.prepare("INSERT INTO course_drafts(code,title,status,created_by_email,design_json,materials_json,activities_json,assessment_config_json,certificate_preapproved) VALUES('E2E-COMM','Professional evidence and practice','active','owner@example.test',?,?,?,?,1)").bind(JSON.stringify(design),JSON.stringify([material]),JSON.stringify([activity,{id:"virtual-one",kind:"virtual_lab",practicalId:"science-measurement-safety",title:"Optional laboratory evidence",required:false,gradingMode:"facilitator",maxMark:100,passMark:60,attemptsAllowed:3}]),JSON.stringify({passMark:60,attempts:"3",questions:[{id:"q1",type:"Multiple choice",prompt:"What supports a responsible decision?",options:["Evidence","Guesswork"],correctAnswer:"Evidence",points:1,approved:true,previewed:true,gradingMode:"rule",outcomeIds:["outcome-1"]}]})).run();
enrolWithSnapshot("learner@example.test","E2E-COMM");
await db.prepare("INSERT INTO colab_assignments(course_code,title,instructions,template_file_key,template_file_name,rubric,attempts_allowed,created_by_email) VALUES('E2E-COMM','Optional notebook','Explain an evidence analysis','test-notebook.ipynb','test-notebook.ipynb','Evidence accuracy and interpretation',3,'owner@example.test')").run();
for(const [name,role] of [["marker","marker"],["moderator","moderator"]])await db.prepare("INSERT INTO course_team(course_code,user_email,team_role,assigned_by) VALUES('E2E-COMM',?,?,'owner@example.test')").bind(`${name}@example.test`,role).run();
await db.prepare("INSERT INTO payment_orders(reference,user_email,course_code,purpose,amount_pesewas,status,paid_at,provider_data_json) VALUES('E2E-RECEIPT','learner@example.test','E2E-COMM','enrollment',8000,'paid',CURRENT_TIMESTAMP,'{\"test\":true}')").run();
console.log(JSON.stringify({seeded:true}));
