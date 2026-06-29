import { getDb } from "@/app/lib/db/client";
import type { OrderStatus, Severity } from "@/app/lib/types";

const WORKSPACE_ID = "ws_redbatch_demo";
const SKU = "RB Power Pack 10000";
const ZONES = ["LAX-01-A1", "LAX-01-B2", "LAX-01-C3"];

function uid(p: string): string {
  return p + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

interface SeedOrder {
  code: string;
  lot: string;
  warehouse: string;
  zone: string;
  status: OrderStatus;
  value_cents: number;
}

function buildOrders(): SeedOrder[] {
  const orders: SeedOrder[] = [];
  const val = (i: number) => 699900 + ((i * 53) % 41) * 13700; // deterministic spread

  // RB-2049 — excluded, same lot/warehouse but ineligible statuses
  const excludedStatuses: OrderStatus[] = ["Shipped", "Delivered", "Cancelled", "On Hold", "Shipped"];
  excludedStatuses.forEach((st, i) => {
    orders.push({
      code: `O-${1001 + i}`,
      lot: "RB-2049",
      warehouse: "LAX-01",
      zone: ZONES[i % ZONES.length],
      status: st,
      value_cents: val(i),
    });
  });

  // RB-2049 — 37 eligible Ready to Ship orders (O-1006 .. O-1042)
  for (let i = 0; i < 37; i++) {
    orders.push({
      code: `O-${1006 + i}`,
      lot: "RB-2049",
      warehouse: "LAX-01",
      zone: ZONES[i % ZONES.length],
      status: "Ready to Ship",
      value_cents: val(i + 5),
    });
  }

  // RB-2049 — different warehouse, excluded by declared scope
  for (let i = 0; i < 6; i++) {
    orders.push({
      code: `O-${1043 + i}`,
      lot: "RB-2049",
      warehouse: "JFK-02",
      zone: "JFK-02-A1",
      status: "Ready to Ship",
      value_cents: val(i + 50),
    });
  }

  // Noise — unrelated lot, never matched
  for (let i = 0; i < 10; i++) {
    orders.push({
      code: `O-${2001 + i}`,
      lot: "RB-3300",
      warehouse: "LAX-01",
      zone: ZONES[i % ZONES.length],
      status: "Ready to Ship",
      value_cents: val(i + 80),
    });
  }

  // RB-7712 — ambiguous lot, 14 candidate Ready to Ship across zones
  for (let i = 0; i < 14; i++) {
    orders.push({
      code: `O-${4001 + i}`,
      lot: "RB-7712",
      warehouse: "LAX-01",
      zone: ZONES[i % ZONES.length],
      status: "Ready to Ship",
      value_cents: val(i + 110),
    });
  }
  // RB-7712 — two excluded
  orders.push({ code: "O-4015", lot: "RB-7712", warehouse: "LAX-01", zone: ZONES[0], status: "Shipped", value_cents: val(130) });
  orders.push({ code: "O-4016", lot: "RB-7712", warehouse: "LAX-01", zone: ZONES[1], status: "Delivered", value_cents: val(131) });

  return orders;
}

export async function seedWorkspace(): Promise<void> {
  const db = getDb();
  const ts = "2026-05-18T09:41:00.000Z";
  const stmts: D1PreparedStatement[] = [];

  stmts.push(
    db
      .prepare("INSERT INTO workspaces (id, name, created_at) VALUES (?, ?, ?)")
      .bind(WORKSPACE_ID, "Red Batch — Demo Workspace", ts),
  );

  // orders
  const ordStmt = db.prepare(
    `INSERT INTO orders (id, code, workspace_id, sku, lot, warehouse, zone, status, value_cents, customer_ref, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const o of buildOrders()) {
    stmts.push(
      ordStmt.bind(
        uid("ord_"),
        o.code,
        WORKSPACE_ID,
        SKU,
        o.lot,
        o.warehouse,
        o.zone,
        o.status,
        o.value_cents,
        `CUST-${o.code.replace("O-", "")}`,
        ts,
      ),
    );
  }

  // helper to add a case + signal + evidence + intake timeline
  function addCase(opts: {
    code: string;
    title: string;
    severity: Severity;
    confidence: number;
    lot: string;
    warehouse: string;
    summary: string;
  }) {
    const caseId = uid("case_");
    const signalId = `SIG-${opts.code}`;
    stmts.push(
      db
        .prepare(
          `INSERT INTO cases (id, code, workspace_id, title, status, signal_id, sku, lot, warehouse, severity, confidence, threshold, plan, scope_hash, affected_count, excluded_count, packet_code, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          caseId,
          opts.code,
          WORKSPACE_ID,
          opts.title,
          "Ready for Containment",
          signalId,
          SKU,
          opts.lot,
          opts.warehouse,
          opts.severity,
          opts.confidence,
          0.7,
          null,
          null,
          0,
          0,
          null,
          ts,
          ts,
        ),
    );
    stmts.push(
      db
        .prepare("INSERT INTO risk_signals (id, case_id, summary, source, received_at, product) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(signalId, caseId, opts.summary, "Customer Support Portal", ts, SKU),
    );

    const ev = db.prepare("INSERT INTO evidence (id, case_id, kind, label, detail, confidence) VALUES (?, ?, ?, ?, ?, ?)");
    stmts.push(ev.bind(uid("ev_"), caseId, "Complaint", "Customer complaint", opts.summary, opts.confidence));
    stmts.push(
      ev.bind(
        uid("ev_"),
        caseId,
        "Lot mapping",
        `Lot ${opts.lot} → ${SKU}`,
        `Lot ${opts.lot} maps to ${SKU} produced for ${opts.warehouse}.`,
        opts.confidence,
      ),
    );
    stmts.push(
      ev.bind(
        uid("ev_"),
        caseId,
        "Policy",
        "Full-stop threshold",
        "Confidence ≥ 0.70 with severity High/Critical authorizes a full stop-ship proposal.",
        null,
      ),
    );

    stmts.push(
      db
        .prepare(
          "INSERT INTO timeline_events (id, case_id, seq, actor, phase, event_type, detail, from_state, to_state, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(uid("tl_"), caseId, 1, "System", "intake", "Case created from customer report", opts.summary, null, "Ready for Containment", ts),
    );
  }

  addCase({
    code: "RB-2049",
    title: "Battery Overheating Complaint",
    severity: "High",
    confidence: 0.92,
    lot: "RB-2049",
    warehouse: "LAX-01",
    summary: "Customer reports battery overheating during normal use of the RB Power Pack 10000.",
  });

  addCase({
    code: "RB-7712",
    title: "Ambiguous Overheating Signal",
    severity: "High",
    confidence: 0.54,
    lot: "RB-7712",
    warehouse: "LAX-01",
    summary:
      "Customer reports overheating, but thermal readings in warehouse logs are within normal range and lot metadata is partially inconsistent across sources.",
  });

  await db.batch(stmts);
}
