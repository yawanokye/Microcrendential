import "./seed-catalogue-test";
import {getRawDb} from "../src/db/raw";
const db=getRawDb();
const row=await db.prepare("SELECT config_json FROM academic_programmes WHERE code='PRG-PUBLIC-CERT'").first<{config_json:string}>();
const c=JSON.parse(row!.config_json);c.award="advanced_certificate";c.entryRequirements="A reviewed institutional admission decision is required.";c.qualificationTitle="Advanced Certificate in Inquiry";
await db.prepare("UPDATE academic_programmes SET config_json=? WHERE code='PRG-PUBLIC-CERT'").bind(JSON.stringify(c)).run();
