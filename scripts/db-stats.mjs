import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync(".data/redbatch.sqlite");
const one = (s) => db.prepare(s).get();
const QUAR = "Quarantined - QA Review";
const out = {
  db_file: ".data/redbatch.sqlite",
  orders_total: one("SELECT COUNT(*) n FROM orders").n,
  orders_quarantined: db.prepare("SELECT COUNT(*) n FROM orders WHERE status = ?").get(QUAR).n,
  orders_ready: db.prepare("SELECT COUNT(*) n FROM orders WHERE status = ?").get("Ready to Ship").n,
  cases: one("SELECT COUNT(*) n FROM cases").n,
  case_orders: one("SELECT COUNT(*) n FROM case_orders").n,
  approvals: one("SELECT COUNT(*) n FROM approvals").n,
  packets: one("SELECT COUNT(*) n FROM packets").n,
  packets_final: db.prepare("SELECT COUNT(*) n FROM packets WHERE status = ?").get("Final").n,
  governed_runs: one("SELECT COUNT(*) n FROM governed_runs").n,
  timeline_events: one("SELECT COUNT(*) n FROM timeline_events").n,
};
console.log(JSON.stringify(out, null, 2));
db.close();
