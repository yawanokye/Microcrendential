import {spawn} from 'node:child_process';
import {accessSync,constants,existsSync,mkdirSync,mkdtempSync,rmdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join,resolve} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),runtime=existsSync(join(root,'server.js'))?root:join(root,'.next','standalone');
try {
  if(Number(process.versions.node.split('.')[0])!==22)throw new Error('This release is validated on Node 22. Set NODE_VERSION=22.23.4 and rebuild.');
  if(!existsSync(join(runtime,'server.js')))throw new Error('Production server is missing. Use npm ci --include=dev followed by npm run build from the extracted project root.');
  for(const path of [join(runtime,'public'),join(runtime,'.next','static'),join(runtime,'scripts','pilot-server.mjs')])if(!existsSync(path))throw new Error('Production assets are missing. Run the complete npm run build command.');
  const dataDir=resolve(root,process.env.DATA_DIR||'.data'),databasePath=resolve(root,process.env.SQLITE_PATH||join(dataDir,'ucc-microcredentials.sqlite')),backupDir=resolve(root,process.env.BACKUP_DIR||join(dataDir,'backups'));
  if(dataDir===root||dataDir==='/'||![databasePath,backupDir].every(p=>p.startsWith(dataDir+'/')))throw new Error('Use a dedicated DATA_DIR with SQLITE_PATH and BACKUP_DIR beneath it.');
  for(const path of [dataDir,join(dataDir,'uploads'),backupDir]){mkdirSync(path,{recursive:true});accessSync(path,constants.R_OK|constants.W_OK);const probe=mkdtempSync(join(path,'.startup-check-'));rmdirSync(probe);}
  const env={...process.env,DATA_DIR:dataDir,SQLITE_PATH:databasePath,BACKUP_DIR:backupDir,HOSTNAME:process.env.APP_BIND_HOST||'0.0.0.0',PORT:process.env.PORT||'3000'};
  const child=spawn(process.execPath,[join(runtime,'scripts','pilot-server.mjs')],{cwd:runtime,env,stdio:'inherit'});
  for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>child.kill(signal));
  child.on('error',error=>{console.error(JSON.stringify({event:'production.start_failed',message:error.message}));process.exitCode=1;});child.on('exit',(code,signal)=>process.exit(signal?0:code??1));
}catch(error){console.error(JSON.stringify({event:'production.start_failed',message:error.message}));process.exitCode=1;}
