// Dump governed_runs + case status for a case code from the live sqlite store.
import { DatabaseSync } from "node:sqlite";
const code = process.argv[2] || "RB-2049";
const db = new DatabaseSync(new URL("../.data/redbatch.sqlite", import.meta.url).pathname);
const c = db.prepare("SELECT id,status,plan,affected_count,excluded_count,packet_code FROM cases WHERE code=?").get(code);
if (!c) { console.log("no case", code); process.exit(0); }
console.log("CASE", code, JSON.stringify(c));
const runs = db.prepare("SELECT kind,mode,run_ref,status,detail,created_at FROM governed_runs WHERE case_id=? ORDER BY created_at").all(c.id);
for (const r of runs) console.log(`  RUN ${r.kind} | ${r.mode} | ${r.run_ref} | ${r.status} | ${r.detail ?? ""}`);
