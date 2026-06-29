import { getDb } from "@/app/lib/db/client";
import { seedWorkspace } from "@/app/lib/db/seed";
import type {
  ApprovalDecision,
  ApprovalRow,
  CaseOrderRow,
  CaseRow,
  CaseStatus,
  ContainmentPlan,
  EvidenceRow,
  EvidenceTaskRow,
  GovernedRunRow,
  OrderRow,
  OrderStatus,
  PacketRow,
  RiskSignalRow,
  TimelineEventRow,
} from "@/app/lib/types";

export function uid(prefix = ""): string {
  return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
export function now(): string {
  return new Date().toISOString();
}

// node:sqlite returns rows with a null prototype. React Server Components
// cannot serialize null-prototype objects across the Server -> Client boundary,
// so every row read from the DB is shallow-copied into a plain object here.
function rowOne<T>(row: unknown): T | undefined {
  return row ? ({ ...(row as Record<string, unknown>) } as T) : undefined;
}
function rowAll<T>(rows: unknown[]): T[] {
  return (rows as Record<string, unknown>[]).map((r) => ({ ...r }) as T);
}

export function ensureSeeded(): void {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) AS n FROM workspaces").get() as { n: number };
  if (!row || row.n === 0) seedWorkspace();
}

export function resetWorkspace(): void {
  const db = getDb();
  for (const t of [
    "governed_runs",
    "evidence_tasks",
    "timeline_events",
    "packets",
    "approvals",
    "evidence",
    "case_orders",
    "orders",
    "risk_signals",
    "cases",
    "workspaces",
  ]) {
    db.exec(`DELETE FROM ${t};`);
  }
  seedWorkspace();
}

/* ----------------------------- cases ----------------------------- */
export function getCase(code: string): CaseRow | undefined {
  return rowOne<CaseRow>(getDb().prepare("SELECT * FROM cases WHERE code = ?").get(code));
}
export function getCaseById(id: string): CaseRow | undefined {
  return rowOne<CaseRow>(getDb().prepare("SELECT * FROM cases WHERE id = ?").get(id));
}
export function listCases(): CaseRow[] {
  return rowAll<CaseRow>(getDb().prepare("SELECT * FROM cases ORDER BY created_at ASC").all());
}
export function updateCaseStatus(id: string, status: CaseStatus): void {
  getDb().prepare("UPDATE cases SET status = ?, updated_at = ? WHERE id = ?").run(status, now(), id);
}
export function setCasePlanScope(
  id: string,
  plan: ContainmentPlan,
  scopeHash: string,
  affected: number,
  excluded: number,
): void {
  getDb()
    .prepare(
      "UPDATE cases SET plan = ?, scope_hash = ?, affected_count = ?, excluded_count = ?, updated_at = ? WHERE id = ?",
    )
    .run(plan, scopeHash, affected, excluded, now(), id);
}
export function setCasePacket(id: string, packetCode: string): void {
  getDb().prepare("UPDATE cases SET packet_code = ?, updated_at = ? WHERE id = ?").run(packetCode, now(), id);
}

/* ----------------------------- signals / evidence ----------------------------- */
export function getSignal(caseId: string): RiskSignalRow | undefined {
  return rowOne<RiskSignalRow>(getDb().prepare("SELECT * FROM risk_signals WHERE case_id = ?").get(caseId));
}
export function getEvidence(caseId: string): EvidenceRow[] {
  return rowAll<EvidenceRow>(getDb().prepare("SELECT * FROM evidence WHERE case_id = ?").all(caseId));
}

/* ----------------------------- orders ----------------------------- */
export function getOrderByCode(code: string): OrderRow | undefined {
  return rowOne<OrderRow>(getDb().prepare("SELECT * FROM orders WHERE code = ?").get(code));
}
export function getOrdersByLot(lot: string): OrderRow[] {
  return rowAll<OrderRow>(getDb().prepare("SELECT * FROM orders WHERE lot = ? ORDER BY code").all(lot));
}
export function updateOrderStatus(id: string, status: OrderStatus): void {
  getDb().prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?").run(status, now(), id);
}

/* ----------------------------- case_orders ----------------------------- */
export function replaceCaseOrders(caseId: string, rows: Omit<CaseOrderRow, "id">[]): void {
  const db = getDb();
  db.prepare("DELETE FROM case_orders WHERE case_id = ?").run(caseId);
  const stmt = db.prepare(
    `INSERT INTO case_orders (id, case_id, order_id, order_code, before_status, proposed_status, final_status, included, reason, mutation_result, verified, zone, value_cents)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const r of rows) {
    stmt.run(
      uid("co_"),
      caseId,
      r.order_id,
      r.order_code,
      r.before_status,
      r.proposed_status,
      r.final_status,
      r.included,
      r.reason,
      r.mutation_result,
      r.verified,
      r.zone,
      r.value_cents,
    );
  }
}
export function getCaseOrders(caseId: string): CaseOrderRow[] {
  return rowAll<CaseOrderRow>(
    getDb().prepare("SELECT * FROM case_orders WHERE case_id = ? ORDER BY included DESC, order_code").all(caseId),
  );
}
export function setCaseOrderResult(id: string, finalStatus: OrderStatus | null, result: string, verified: number): void {
  getDb()
    .prepare("UPDATE case_orders SET final_status = ?, mutation_result = ?, verified = ? WHERE id = ?")
    .run(finalStatus, result, verified, id);
}

/* ----------------------------- approvals ----------------------------- */
export function addApproval(
  caseId: string,
  role: string,
  name: string,
  decision: ApprovalDecision,
  reason: string | null,
  scopeCount: number,
  scopeHash: string,
): ApprovalRow {
  const row: ApprovalRow = {
    id: uid("ap_"),
    case_id: caseId,
    approver_role: role,
    approver_name: name,
    decision,
    reason,
    scope_count: scopeCount,
    scope_hash: scopeHash,
    created_at: now(),
  };
  getDb()
    .prepare(
      `INSERT INTO approvals (id, case_id, approver_role, approver_name, decision, reason, scope_count, scope_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(row.id, row.case_id, row.approver_role, row.approver_name, row.decision, row.reason, row.scope_count, row.scope_hash, row.created_at);
  return row;
}
export function getApprovals(caseId: string): ApprovalRow[] {
  return rowAll<ApprovalRow>(getDb().prepare("SELECT * FROM approvals WHERE case_id = ? ORDER BY created_at").all(caseId));
}

/* ----------------------------- packets ----------------------------- */
export function createPacket(
  caseId: string,
  code: string,
  status: "Final" | "Pending" | "Partial",
  summary: unknown,
): PacketRow {
  const row: PacketRow = {
    id: uid("pk_"),
    code,
    case_id: caseId,
    status,
    summary_json: JSON.stringify(summary),
    created_at: now(),
  };
  getDb()
    .prepare("INSERT INTO packets (id, code, case_id, status, summary_json, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(row.id, row.code, row.case_id, row.status, row.summary_json, row.created_at);
  return row;
}
export function getPacketByCode(code: string): PacketRow | undefined {
  return rowOne<PacketRow>(getDb().prepare("SELECT * FROM packets WHERE code = ?").get(code));
}
export function getPacketByCase(caseId: string): PacketRow | undefined {
  return rowOne<PacketRow>(
    getDb().prepare("SELECT * FROM packets WHERE case_id = ? ORDER BY created_at DESC LIMIT 1").get(caseId),
  );
}

/* ----------------------------- timeline ----------------------------- */
export function nextSeq(caseId: string): number {
  const r = getDb().prepare("SELECT COALESCE(MAX(seq),0) AS m FROM timeline_events WHERE case_id = ?").get(caseId) as {
    m: number;
  };
  return (r?.m ?? 0) + 1;
}
export function addTimeline(
  caseId: string,
  actor: string,
  eventType: string,
  detail: string,
  opts: { phase?: string; from?: CaseStatus | null; to?: CaseStatus | null } = {},
): void {
  getDb()
    .prepare(
      `INSERT INTO timeline_events (id, case_id, seq, actor, phase, event_type, detail, from_state, to_state, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      uid("tl_"),
      caseId,
      nextSeq(caseId),
      actor,
      opts.phase ?? null,
      eventType,
      detail,
      opts.from ?? null,
      opts.to ?? null,
      now(),
    );
}
export function getTimeline(caseId: string): TimelineEventRow[] {
  return rowAll<TimelineEventRow>(getDb().prepare("SELECT * FROM timeline_events WHERE case_id = ? ORDER BY seq").all(caseId));
}

/* ----------------------------- evidence tasks ----------------------------- */
export function addEvidenceTask(caseId: string, label: string, detail: string): EvidenceTaskRow {
  const row: EvidenceTaskRow = {
    id: uid("et_"),
    case_id: caseId,
    label,
    detail,
    status: "Queued",
    created_at: now(),
  };
  getDb()
    .prepare("INSERT INTO evidence_tasks (id, case_id, label, detail, status, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(row.id, row.case_id, row.label, row.detail, row.status, row.created_at);
  return row;
}
export function getEvidenceTasks(caseId: string): EvidenceTaskRow[] {
  return rowAll<EvidenceTaskRow>(getDb().prepare("SELECT * FROM evidence_tasks WHERE case_id = ? ORDER BY created_at").all(caseId));
}

/* ----------------------------- governed runs ----------------------------- */
export function addGovernedRun(
  caseId: string,
  kind: string,
  mode: "cloud" | "local-governed",
  runRef: string,
  status: string,
  detail: string | null = null,
): GovernedRunRow {
  const row: GovernedRunRow = {
    id: uid("gr_"),
    case_id: caseId,
    kind,
    mode,
    run_ref: runRef,
    status,
    detail,
    created_at: now(),
  };
  getDb()
    .prepare("INSERT INTO governed_runs (id, case_id, kind, mode, run_ref, status, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(row.id, row.case_id, row.kind, row.mode, row.run_ref, row.status, row.detail, row.created_at);
  return row;
}
export function getGovernedRuns(caseId: string): GovernedRunRow[] {
  return rowAll<GovernedRunRow>(getDb().prepare("SELECT * FROM governed_runs WHERE case_id = ? ORDER BY created_at").all(caseId));
}
export function updateGovernedRunByRef(caseId: string, runRef: string, status: string, detail?: string | null): void {
  if (detail === undefined) {
    getDb().prepare("UPDATE governed_runs SET status = ? WHERE case_id = ? AND run_ref = ?").run(status, caseId, runRef);
  } else {
    getDb().prepare("UPDATE governed_runs SET status = ?, detail = ? WHERE case_id = ? AND run_ref = ?").run(status, detail, caseId, runRef);
  }
}

/* ----------------------------- search ----------------------------- */
export interface SearchResult {
  kind: "order" | "case" | "packet" | "lot";
  code: string;
  label: string;
  href: string;
  detail: string;
}
export function search(q: string): SearchResult[] {
  const db = getDb();
  const term = q.trim();
  if (!term) return [];
  const like = `%${term}%`;
  const results: SearchResult[] = [];

  const pkt = db.prepare("SELECT * FROM packets WHERE code LIKE ? ORDER BY created_at DESC").all(like) as unknown as PacketRow[];
  for (const p of pkt) {
    const c = getCaseById(p.case_id);
    results.push({
      kind: "packet",
      code: p.code,
      label: `Stop-Ship Packet ${p.code}`,
      href: `/packets/${p.code}`,
      detail: `${p.status} • case ${c?.code ?? "?"}`,
    });
  }
  const cases = db.prepare("SELECT * FROM cases WHERE code LIKE ? OR lot LIKE ? ORDER BY created_at").all(like, like) as unknown as CaseRow[];
  for (const c of cases) {
    results.push({
      kind: "case",
      code: c.code,
      label: `Case ${c.code} — ${c.title}`,
      href: `/cases/${c.code}`,
      detail: `${c.status} • lot ${c.lot} • ${c.warehouse}`,
    });
  }
  const orders = db.prepare("SELECT * FROM orders WHERE code LIKE ? ORDER BY code LIMIT 12").all(like) as unknown as OrderRow[];
  for (const o of orders) {
    // find a case that quarantined this order, if any
    const co = db
      .prepare("SELECT * FROM case_orders WHERE order_code = ? AND included = 1 ORDER BY rowid DESC LIMIT 1")
      .get(o.code) as unknown as CaseOrderRow | undefined;
    const c = co ? getCaseById(co.case_id) : undefined;
    results.push({
      kind: "order",
      code: o.code,
      label: `Order ${o.code}`,
      href: c ? `/cases/${c.code}?order=${o.code}` : `/reopen?order=${o.code}`,
      detail: `${o.status} • lot ${o.lot} • ${o.warehouse}${c ? ` • frozen by ${c.code}` : ""}`,
    });
  }
  return results;
}
