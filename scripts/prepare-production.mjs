import {cpSync,existsSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),runtime=join(root,'.next','standalone');
if(!existsSync(join(runtime,'server.js')))throw new Error('The standalone server was not built. Run the complete npm run build command.');
for(const [source,destination] of [['public','public'],['.next/static','.next/static'],['scripts','scripts']]){const target=join(runtime,destination);mkdirSync(target,{recursive:true});cpSync(join(root,source),target,{recursive:true});}
console.log('Production package prepared, including public files, static assets and maintenance scripts.');
