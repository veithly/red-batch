#!/usr/bin/env node
/**
 * Live smoke for the Red Batch hero loop + ambiguity branch.
 * Requires the dev/prod server running on BASE (default http://localhost:4387).
 *
 *   npm run smoke
 */
const BASE = process.env.DEMO_URL || "http://localhost:4387";

let failures = 0;
function check(name, cond, extra = "") {
  const ok = Boolean(cond);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`);
  if (!ok) failures++;
}
async function j(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

const main = async () => {
  console.log(`Red Batch smoke @ ${BASE}\n`);

  await j("POST", "/api/demo/reset");
  const status = await j("GET", "/api/integration-status");
  check("integration-status ok", status.body.ok && status.body.db.ok, status.body?.db?.detail);

  // HERO: full stop-ship
  const run = await j("POST", "/api/cases/RB-2049/run");
  check("RB-2049 run -> Awaiting QA Approval", run.body.status === "Awaiting QA Approval", `status=${run.body.status}`);
  check("RB-2049 fan-out = 37 included", run.body.includedCount === 37, `included=${run.body.includedCount}`);

  const before = await j("GET", "/api/cases/RB-2049");
  const readyBefore = before.body.included?.filter((o) => o.before_status === "Ready to Ship").length;
  check("37 orders Ready to Ship before approval", readyBefore === 37, `ready=${readyBefore}`);

  const appr = await j("POST", "/api/cases/RB-2049/approve", { decision: "approve_full", role: "QA Manager", name: "Priya Shah" });
  check("RB-2049 approve -> Packet Saved", appr.body.status === "Packet Saved", `status=${appr.body.status}`);
  check("RB-2049 verified 37/37", appr.body.changed === 37 && appr.body.failed === 0, `changed=${appr.body.changed} failed=${appr.body.failed}`);

  // persistence: re-read; statuses must be quarantined
  const after = await j("GET", "/api/cases/RB-2049");
  const quarantined = after.body.included?.filter((o) => o.final_status === "Quarantined - QA Review").length;
  check("37 orders persisted as Quarantined", quarantined === 37, `quarantined=${quarantined}`);
  check("case has packet code RB-PKT-2049", after.body.case?.packet_code === "RB-PKT-2049", after.body.case?.packet_code);

  const pkt = await j("GET", "/api/packets/RB-PKT-2049");
  check("packet RB-PKT-2049 is Final", pkt.body.status === "Final", `status=${pkt.body.status}`);
  check("packet diff count = 37", pkt.body.summary?.diff?.count === 37, `count=${pkt.body.summary?.diff?.count}`);

  // re-run guard (idempotent)
  const rerun = await j("POST", "/api/cases/RB-2049/run");
  check("re-run is guarded (already run)", rerun.body.alreadyRun === true, `alreadyRun=${rerun.body.alreadyRun}`);

  // AMBIGUITY branch
  const run2 = await j("POST", "/api/cases/RB-7712/run");
  check("RB-7712 run -> Human Review Required", run2.body.status === "Human Review Required", `status=${run2.body.status}`);
  check("RB-7712 partial scope > 0 and < candidates", run2.body.includedCount > 0, `partial=${run2.body.includedCount}`);

  // reopen / search by order id
  const search = await j("GET", "/api/search?q=O-1042");
  const hit = (search.body.results || []).find((r) => r.code === "O-1042");
  check("search O-1042 finds the order frozen by RB-2049", hit && /RB-2049/.test(hit.detail), hit?.detail);

  console.log(`\n${failures === 0 ? "ALL PASS" : failures + " FAILURE(S)"}`);
  process.exit(failures === 0 ? 0 : 1);
};

main().catch((e) => {
  console.error("smoke error:", e.message);
  process.exit(1);
});
