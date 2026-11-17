import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

test("encrypted backups can be restored and reject altered or incorrectly keyed archives",()=>{
  const dir=mkdtempSync(join(tmpdir(),"ucc-backup-crypto-")),source=join(dir,"source.tar.gz"),encrypted=join(dir,"archive.enc"),restored=join(dir,"restored.tar.gz"),tampered=join(dir,"tampered.enc"),badOutput=join(dir,"bad.tar.gz");
  const bytes=Buffer.from("Synthetic private backup contents for an isolated test.");writeFileSync(source,bytes);
  const run=(args,key)=>execFileSync(process.execPath,["scripts/encrypted-backup.mjs",...args],{env:{...process.env,BACKUP_ENCRYPTION_KEY_BASE64:Buffer.alloc(32,key).toString("base64")},stdio:"pipe"});
  run(["encrypt",source,encrypted],3);assert.equal(readFileSync(encrypted).includes(bytes),false);
  run(["decrypt",encrypted,restored],3);assert.deepEqual(readFileSync(restored),bytes);assert.ok(existsSync(restored+".sha256"));
  const changed=readFileSync(encrypted);changed[changed.length-1]^=1;writeFileSync(tampered,changed);
  assert.throws(()=>run(["decrypt",tampered,badOutput],3));assert.equal(existsSync(badOutput),false);
  assert.throws(()=>run(["decrypt",encrypted,badOutput],9));assert.equal(existsSync(badOutput),false);
  assert.equal(readdirSync(dir).some(name=>name.includes(".partial-")),false);
});
