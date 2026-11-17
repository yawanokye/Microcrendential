import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { appendFileSync, closeSync, createReadStream, createWriteStream, existsSync, linkSync, openSync, readSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { pipeline } from "node:stream/promises";

// AES-256-GCM, with an authenticated random nonce. Keys never enter the archive.
const magic=Buffer.from("UCCBKP1\n"), headerLength=magic.length+12,tagLength=16;
const [operation,inputArgument,outputArgument]=process.argv.slice(2);
const encodedKey=process.env.BACKUP_ENCRYPTION_KEY_BASE64||"",key=Buffer.from(encodedKey,"base64");
if(!["encrypt","decrypt"].includes(operation)||!inputArgument||!outputArgument)throw new Error("Usage: node scripts/encrypted-backup.mjs encrypt|decrypt input output");
if(key.length!==32)throw new Error("BACKUP_ENCRYPTION_KEY_BASE64 must contain a securely generated 32-byte key.");
const input=resolve(inputArgument),output=resolve(outputArgument),partial=output+".partial-"+randomBytes(8).toString("hex");
if(input===output||existsSync(output)||operation==="decrypt"&&existsSync(output+".sha256"))throw new Error("Choose a new output path; existing files are never overwritten.");
if(!existsSync(input))throw new Error("Input backup was not found.");
try {
  if(operation==="encrypt"){
    const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",key,iv);cipher.setAAD(magic);
    const destination=createWriteStream(partial,{flags:"wx",mode:0o600});
    destination.write(Buffer.concat([magic,iv]));
    await pipeline(createReadStream(input),cipher,destination);
    appendFileSync(partial,cipher.getAuthTag());
  }else{
    const size=statSync(input).size;if(size<headerLength+tagLength)throw new Error("The encrypted archive is incomplete.");
    const fd=openSync(input,"r"),header=Buffer.alloc(headerLength),tag=Buffer.alloc(tagLength);
    try{readSync(fd,header,0,header.length,0);readSync(fd,tag,0,tag.length,size-tagLength);}finally{closeSync(fd);}
    if(!header.subarray(0,magic.length).equals(magic))throw new Error("The encrypted archive format is not recognised.");
    const decipher=createDecipheriv("aes-256-gcm",key,header.subarray(magic.length));decipher.setAAD(magic);decipher.setAuthTag(tag);
    const destination=createWriteStream(partial,{flags:"wx",mode:0o600});
    await pipeline(createReadStream(input,{start:headerLength,end:size-tagLength-1}),decipher,destination);
  }
  linkSync(partial,output);rmSync(partial);
  if(operation==="decrypt"){
    const hash=createHash("sha256");for await(const chunk of createReadStream(output))hash.update(chunk);
    writeFileSync(output+".sha256",`${hash.digest("hex")}  ${basename(output)}\n`,{flag:"wx",mode:0o600});
  }
  console.log(JSON.stringify({status:"completed",operation,output}));
} catch(error) {
  rmSync(partial,{force:true});
  console.error(JSON.stringify({status:"failed",operation,message:error instanceof Error?error.message:"Backup processing failed."}));
  process.exitCode=1;
}
