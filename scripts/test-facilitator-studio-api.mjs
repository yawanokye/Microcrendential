import assert from 'node:assert/strict';
import {mkdtempSync,cpSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHmac} from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
const directory=mkdtempSync(join(tmpdir(),'ucc-browser-test-')),port=Number(process.env.TEST_PORT||3110),origin=`http://127.0.0.1:${port}`,secret='isolated-facilitator-studio-test';
const env={...process.env,DATA_DIR:directory,SQLITE_PATH:join(directory,'test.sqlite'),AUTH_SECRET:secret,NODE_ENV:'production',DEMONSTRATION_FULL_FUNCTIONALITY:'true',NEXT_PUBLIC_APP_URL:origin,AUTO_BACKUP_ENABLED:'false',PORT:String(port),HOSTNAME:'127.0.0.1'};
for(const key of Object.keys(env))if(/^(OPENAI_|GOOGLE_|RESEND_|GMAIL_|SMTP_)/.test(key)||key==='SUPPORT_EMAIL')delete env[key];
execFileSync(process.execPath,['--import','tsx','scripts/seed-native-test.ts'],{env,stdio:'pipe'});
cpSync('public','.next/standalone/public',{recursive:true});cpSync('.next/static','.next/standalone/.next/static',{recursive:true});
const server=spawn(process.execPath,['.next/standalone/server.js'],{env,stdio:['ignore','pipe','pipe']});let logs='';server.stdout.on('data',d=>logs+=d);server.stderr.on('data',d=>logs+=d);
const cookie=name=>{const body=Buffer.from(JSON.stringify({email:`${name}@example.test`,fullName:`Test ${name}`,expiresAt:Date.now()+3600000,version:3,sessionVersion:1})).toString('base64url');return `${body}.${createHmac('sha256',secret).update(body).digest('base64url')}`;};
async function api(name,path,body,method='POST'){const response=await fetch(origin+path,{method:body?method:'GET',headers:{cookie:`ucc_render_session=${cookie(name)}`,origin,...(body instanceof FormData?{}:{'content-type':'application/json'})},...(body?{body:body instanceof FormData?body:JSON.stringify(body)}:{})});return {response,data:await response.json()};}
const checks=[];
try{
  let ready=false;for(let i=0;i<100;i++){try{if((await fetch(origin+'/api/health/live')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}assert.ok(ready);
  let result=await api('learner','/api/courses?code=E2E-NATIVE');assert.equal(result.response.status,200);const course=result.data.courses[0];
  assert.equal(course.activities.length,5);for(const a of course.activities){assert.equal(a.interactive.order,undefined);if(a.interactive.kind!=='flashcards')assert.ok(a.interactive.items.every(i=>i.answer===undefined&&i.explanation===undefined));}checks.push('Enrolled learners receive working practice without knowledge-check, match, sequence or scenario answer keys');
  result=await api('outsider','/api/courses?code=E2E-NATIVE');assert.ok(!JSON.stringify(result.data).includes('correctAnswer'));checks.push('Unassigned staff cannot recover native answer keys');
  result=await api('learner','/api/assessments',{courseCode:'E2E-NATIVE',answers:{final:'Evidence'}});assert.equal(result.response.status,409);checks.push('Required practice blocks final assessment until server-confirmed completion');
  for(const kind of ['knowledge_check','matching','sequencing','flashcards','scenario']){
    const response=kind==='sequencing'?{order:['b','a']}:kind==='flashcards'?{reviewed:['a','b']}:{selections:{a:'Evidence',b:'Review'},mark:0};const form=new FormData();form.append('courseCode','E2E-NATIVE');form.append('activityId',kind);form.append('responseText',JSON.stringify(response));
    result=await api('learner','/api/learning-activity-submissions',form);assert.equal(result.response.status,201,JSON.stringify(result.data));assert.equal(result.data.submission.mark,100);assert.equal(result.data.submission.passed,true);assert.equal(result.data.submission.criteria.length,2);checks.push(`${kind}: server grades and stores a pass with item feedback`);
    result=await api('learner','/api/learning-activity-submissions',form);assert.equal(result.response.status,409);checks.push(`${kind}: duplicate pass does not consume another attempt`);
    result=await api('learner','/api/learning-progress',{courseCode:'E2E-NATIVE',materialId:`native-${kind}`,completed:true});assert.equal(result.response.status,200);
  }
  result=await api('learner','/api/course-activity-status?courseCode=E2E-NATIVE');assert.equal(Object.values(result.data.statuses).filter(s=>s.passed).length,5);checks.push('All five native activity passes are visible in learner progress');
  result=await api('owner','/api/delivery/evidence?courseCode=E2E-NATIVE&filter=all');assert.equal(result.data.items.length,5);checks.push('Native evidence appears in the facilitator gradebook evidence queue');
  result=await api('learner','/api/assessments',{courseCode:'E2E-NATIVE',answers:{final:'Evidence'}});assert.equal(result.response.status,202);checks.push('Completing native practice and lessons unlocks the approved final assessment');
  const template={title:'Evidence decisions',interactive:{kind:'knowledge_check',items:[{id:'a',prompt:'Evidence?',choices:['Check','Ignore'],answer:'Check',explanation:'Check reliable evidence.'},{id:'b',prompt:'Next?',choices:['Review','Ignore'],answer:'Review',explanation:'Review the criteria.'}]}};
  result=await api('owner','/api/course-ai/activity-library',template);assert.equal(result.response.status,201);const templateId=result.data.id;result=await api('owner','/api/course-ai/activity-library');assert.equal(result.data.items[0].id,templateId);checks.push('Reusable activity templates persist');
  result=await api('outsider','/api/course-ai/activity-library');assert.equal(result.data.items.length,0);result=await api('learner','/api/course-ai/activity-library',template);assert.equal(result.response.status,403);checks.push('Activity library is private to its facilitator and unavailable to learners');
  result=await api('owner','/api/course-ai/activity-library',{title:'Broken answer',interactive:{...template.interactive,items:template.interactive.items.map(i=>({...i,answer:'invalid'}))}});assert.equal(result.response.status,400);checks.push('Activity library rejects invalid answer keys');
  result=await api('owner','/api/course-ai/activity-library',{id:templateId},'DELETE');assert.equal(result.response.status,200);
  result=await api('owner','/api/course-ai/jobs',{dailyLimit:1},'PATCH');assert.equal(result.response.status,403);result=await api('admin','/api/course-ai/jobs',{dailyLimit:1},'PATCH');assert.equal(result.response.status,200);checks.push('Only an administrator can change institutional daily AI limits');
  const form=new FormData();form.append('mode','idea');form.append('sourceText','Build a procurement course for Ghanaian officers to evaluate evidence.');form.append('stage','outline');form.append('brief',JSON.stringify({audience:'Procurement officers',goals:'Evaluate evidence'}));
  result=await api('owner','/api/course-ai/design',form);assert.equal(result.response.status,202);const jobId=result.data.job.id;
  for(let i=0;i<20;i++){result=await api('owner','/api/course-ai/jobs');if(result.data.jobs.find(j=>j.id===jobId)?.status==='failed')break;await new Promise(r=>setTimeout(r,100));}assert.equal(result.data.jobs.find(j=>j.id===jobId)?.status,'failed');assert.ok(!JSON.stringify(result.data).includes('input_json'));checks.push('Failed AI request survives the initial connection and can be reviewed after refresh');
  result=await api('outsider','/api/course-ai/jobs');assert.equal(result.data.jobs.length,0);checks.push('Saved AI requests are private to their owner');result=await api('owner','/api/course-ai/design',form);assert.equal(result.response.status,429);checks.push('Daily AI usage limit is enforced before provider generation');
  const out=resolve(process.env.TEST_ARTIFACT_DIR||'validation/facilitator-studio');mkdirSync(out,{recursive:true});writeFileSync(join(out,'api-results.json'),JSON.stringify({passed:checks.length,checks,node:process.version,liveAi:'Not called. Provider keys were removed from the isolated environment.'},null,2));console.log(JSON.stringify({passed:checks.length,checks}));
}catch(e){console.error(logs.slice(-5000));throw e;}finally{server.kill('SIGTERM');}
