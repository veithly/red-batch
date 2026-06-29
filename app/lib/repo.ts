import { getDb, q1, qAll, run } from "@/app/lib/db/client";
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

export async function ensureSeeded(): Promise<void> {
  const row = await q1<{ n: number }>("SELECT COUNT(*) AS n FROM workspaces");
  if (!row || row.n === 0) await seedWorkspace();
}

export async function resetWorkspace(): Promise<void> {
  const db = getDb();
  await db.batch(
    [
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
    ].map((t) => db.prepare(`DELETE FROM ${t}`)),
  );
  await seedWorkspace();
}

/* ----------------------------- cases ----------------------------- */
export async function getCase(code: string): Promise<CaseRow | undefined> {
  return q1<CaseRow>("SELECT * FROM cases WHERE code = ?", code);
}
export async function getCaseById(id: string): Promise<CaseRow | undefined> {
  return q1<CaseRow>("SELECT * FROM cases WHERE id = ?", id);
}
export async function listCases(): Promise<CaseRow[]> {
  return qAll<CaseRow>("SELECT * FROM cases ORDER BY created_at ASC");
}
export async function updateCaseStatus(id: string, status: CaseStatus): Promise<void> {
  await run("UPDATE cases SET status = ?, updated_at = ? WHERE id = ?", status, now(), id);
}
export async function setCasePlanScope(
  id: string,
  plan: ContainmentPlan,
  scopeHash: string,
  affected: number,
  excluded: number,
): Promise<void> {
  await run(
    "UPDATE cases SET plan = ?, scope_hash = ?, affected_count = ?, excluded_count = ?, updated_at = ? WHERE id = ?",
    plan,
    scopeHash,
    affected,
    excluded,
    now(),
    id,
  );
}
export async function setCasePacket(id: string, packetCode: string): Promise<void> {
  await run("UPDATE cases SET packet_code = ?, updated_at = ? WHERE id = ?", packetCode, now(), id);
}

/* ----------------------------- signals / evidence ----------------------------- */
export async function getSignal(caseId: string): Promise<RiskSignalRow | undefined> {
  return q1<RiskSignalRow>("SELECT * FROM risk_signals WHERE case_id = ?", caseId);
}
export async function getEvidence(caseId: string): Promise<EvidenceRow[]> {
  return qAll<EvidenceRow>("SELECT * FROM evidence WHERE case_id = ?", caseId);
}

/* ----------------------------- orders ----------------------------- */
export async function getOrderByCode(code: string): Promise<OrderRow | undefined> {
  return q1<OrderRow>("SELECT * FROM orders WHERE code = ?", code);
}
export async function getOrdersByLot(lot: string): Promise<OrderRow[]> {
  return qAll<OrderRow>("SELECT * FROM orders WHERE lot = ? ORDER BY code", lot);
}
export async function updateOrderStatus(id: string, status: OrderStatus): Promise<void> {
  await run("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?", status, now(), id);
}

/* ----------------------------- case_orders ----------------------------- */
export async function replaceCaseOrders(caseId: string, rows: Omit<CaseOrderRow, "id">[]): Promise<void> {
  const db = getDb();
  const insert = db.prepare(
    `INSERT INTO case_orders (id, case_id, order_id, order_code, before_status, proposed_status, final_status, included, reason, mutation_result, verified, zone, value_cents)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const stmts: D1PreparedStatement[] = [db.prepare("DELETE FROM case_orders WHERE case_id = ?").bind(caseId)];
  for (const r of rows) {
    stmts.push(
      insert.bind(
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
      ),
    );
  }
  await db.batch(stmts);
}
export async function getCaseOrders(caseId: string): Promise<CaseOrderRow[]> {
  return qAll<CaseOrderRow>(
    "SELECT * FROM case_orders WHERE case_id = ? ORDER BY included DESC, order_code",
    caseId,
  );
}
export async function setCaseOrderResult(
  id: string,
  finalStatus: OrderStatus | null,
  result: string,
  verified: number,
): Promise<void> {
  await run(
    "UPDATE case_orders SET final_status = ?, mutation_result = ?, verified = ? WHERE id = ?",
    finalStatus,
    result,
    verified,
    id,
  );
}

/* ----------------------------- approvals ----------------------------- */
export async function addApproval(
  caseId: string,
  role: string,
  name: string,
  decision: ApprovalDecision,
  reason: string | null,
  scopeCount: number,
  scopeHash: string,
): Promise<ApprovalRow> {
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
  await run(
    `INSERT INTO approvals (id, case_id, approver_role, approver_name, decision, reason, scope_count, scope_hash, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    row.id,
    row.case_id,
    row.approver_role,
    row.approver_name,
    row.decision,
    row.reason,
    row.scope_count,
    row.scope_hash,
    row.created_at,
  );
  return row;
}
export async function getApprovals(caseId: string): Promise<ApprovalRow[]> {
  return qAll<ApprovalRow>("SELECT * FROM approvals WHERE case_id = ? ORDER BY created_at", caseId);
}

/* ----------------------------- packets ----------------------------- */
export async function createPacket(
  caseId: string,
  code: string,
  status: "Final" | "Pending" | "Partial",
  summary: unknown,
): Promise<PacketRow> {
  const row: PacketRow = {
    id: uid("pk_"),
    code,
    case_id: caseId,
    status,
    summary_json: JSON.stringify(summary),
    created_at: now(),
  };
  await run(
    "INSERT INTO packets (id, code, case_id, status, summary_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    row.id,
    row.code,
    row.case_id,
    row.status,
    row.summary_json,
    row.created_at,
  );
  return row;
}
export async function getPacketByCode(code: string): Promise<PacketRow | undefined> {
  return q1<PacketRow>("SELECT * FROM packets WHERE code = ?", code);
}
export async function getPacketByCase(caseId: string): Promise<PacketRow | undefined> {
  return q1<PacketRow>("SELECT * FROM packets WHERE case_id = ? ORDER BY created_at DESC LIMIT 1", caseId);
}

/* ----------------------------- timeline ----------------------------- */
export async function nextSeq(caseId: string): Promise<number> {
  const r = await q1<{ m: number }>(
    "SELECT COALESCE(MAX(seq),0) AS m FROM timeline_events WHERE case_id = ?",
    caseId,
  );
  return (r?.m ?? 0) + 1;
}
export async function addTimeline(
  caseId: string,
  actor: string,
  eventType: string,
  detail: string,
  opts: { phase?: string; from?: CaseStatus | null; to?: CaseStatus | null } = {},
): Promise<void> {
  await run(
    `INSERT INTO timeline_events (id, case_id, seq, actor, phase, event_type, detail, from_state, to_state, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    uid("tl_"),
    caseId,
    await nextSeq(caseId),
    actor,
    opts.phase ?? null,
    eventType,
    detail,
    opts.from ?? null,
    opts.to ?? null,
    now(),
  );
}
export async function getTimeline(caseId: string): Promise<TimelineEventRow[]> {
  return qAll<TimelineEventRow>("SELECT * FROM timeline_events WHERE case_id = ? ORDER BY seq", caseId);
}

/* ----------------------------- evidence tasks ----------------------------- */
export async function addEvidenceTask(caseId: string, label: string, detail: string): Promise<EvidenceTaskRow> {
  const row: EvidenceTaskRow = {
    id: uid("et_"),
    case_id: caseId,
    label,
    detail,
    status: "Queued",
    created_at: now(),
  };
  await run(
    "INSERT INTO evidence_tasks (id, case_id, label, detail, status, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    row.id,
    row.case_id,
    row.label,
    row.detail,
    row.status,
    row.created_at,
  );
  return row;
}
export async function getEvidenceTasks(caseId: string): Promise<EvidenceTaskRow[]> {
  return qAll<EvidenceTaskRow>("SELECT * FROM evidence_tasks WHERE case_id = ? ORDER BY created_at", caseId);
}

/* ----------------------------- governed runs ----------------------------- */
export async function addGovernedRun(
  caseId: string,
  kind: string,
  mode: "cloud" | "local-governed",
  runRef: string,
  status: string,
  detail: string | null = null,
): Promise<GovernedRunRow> {
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
  await run(
    "INSERT INTO governed_runs (id, case_id, kind, mode, run_ref, status, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    row.id,
    row.case_id,
    row.kind,
    row.mode,
    row.run_ref,
    row.status,
    row.detail,
    row.created_at,
  );
  return row;
}
export async function getGovernedRuns(caseId: string): Promise<GovernedRunRow[]> {
  return qAll<GovernedRunRow>("SELECT * FROM governed_runs WHERE case_id = ? ORDER BY created_at", caseId);
}
export async function updateGovernedRunByRef(
  caseId: string,
  runRef: string,
  status: string,
  detail?: string | null,
): Promise<void> {
  if (detail === undefined) {
    await run("UPDATE governed_runs SET status = ? WHERE case_id = ? AND run_ref = ?", status, caseId, runRef);
  } else {
    await run(
      "UPDATE governed_runs SET status = ?, detail = ? WHERE case_id = ? AND run_ref = ?",
      status,
      detail,
      caseId,
      runRef,
    );
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
export async function search(q: string): Promise<SearchResult[]> {
  const term = q.trim();
  if (!term) return [];
  const like = `%${term}%`;
  const results: SearchResult[] = [];

  const pkt = await qAll<PacketRow>("SELECT * FROM packets WHERE code LIKE ? ORDER BY created_at DESC", like);
  for (const p of pkt) {
    const c = await getCaseById(p.case_id);
    results.push({
      kind: "packet",
      code: p.code,
      label: `Stop-Ship Packet ${p.code}`,
      href: `/packets/${p.code}`,
      detail: `${p.status} • case ${c?.code ?? "?"}`,
    });
  }
  const cases = await qAll<CaseRow>(
    "SELECT * FROM cases WHERE code LIKE ? OR lot LIKE ? ORDER BY created_at",
    like,
    like,
  );
  for (const c of cases) {
    results.push({
      kind: "case",
      code: c.code,
      label: `Case ${c.code} — ${c.title}`,
      href: `/cases/${c.code}`,
      detail: `${c.status} • lot ${c.lot} • ${c.warehouse}`,
    });
  }
  const orders = await qAll<OrderRow>("SELECT * FROM orders WHERE code LIKE ? ORDER BY code LIMIT 12", like);
  for (const o of orders) {
    const co = await q1<CaseOrderRow>(
      "SELECT * FROM case_orders WHERE order_code = ? AND included = 1 ORDER BY rowid DESC LIMIT 1",
      o.code,
    );
    const c = co ? await getCaseById(co.case_id) : undefined;
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
