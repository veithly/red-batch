import {
  addApproval,
  addEvidenceTask,
  addGovernedRun,
  addTimeline,
  createPacket,
  getCase,
  getCaseOrders,
  getEvidence,
  getGovernedRuns,
  getOrderByCode,
  getOrdersByLot,
  getSignal,
  replaceCaseOrders,
  setCaseOrderResult,
  setCasePacket,
  setCasePlanScope,
  updateCaseStatus,
  updateGovernedRunByRef,
  updateOrderStatus,
} from "@/app/lib/repo";
import { decidePlan, scopeHashOf } from "@/app/lib/policy";
import {
  runRef,
  uipathMode,
  startCloudProcess,
  createApprovalTask,
  completeApprovalTask,
} from "@/app/lib/uipath/orchestrator";
import { narrate } from "@/app/lib/llm";
import type { ApprovalDecision, CaseOrderRow, CaseRow, OrderRow } from "@/app/lib/types";

export interface TraceStep {
  phase: string;
  title: string;
  detail: string;
}

export interface RunResult {
  ok: true;
  alreadyRun: boolean;
  caseCode: string;
  status: string;
  plan: string;
  rationale: string;
  includedCount: number;
  excludedCount: number;
  trace: TraceStep[];
}

function packetCodeFor(caseCode: string): string {
  const num = caseCode.split("-").pop() ?? caseCode;
  return `RB-PKT-${num}`;
}

export async function runContainment(caseCode: string): Promise<RunResult> {
  const c = getCase(caseCode);
  if (!c) throw Object.assign(new Error("Case not found"), { code: 404 });

  if (c.status !== "Ready for Containment") {
    return {
      ok: true,
      alreadyRun: true,
      caseCode,
      status: c.status,
      plan: c.plan ?? "",
      rationale: "Containment has already run for this case.",
      includedCount: c.affected_count,
      excludedCount: c.excluded_count,
      trace: [],
    };
  }

  const signal = getSignal(c.id);
  const mode = uipathMode();
  const trace: TraceStep[] = [];

  updateCaseStatus(c.id, "Analyzing");
  addTimeline(c.id, "Batch Containment Agent", "Agent run started", "Reading risk signal and order graph.", {
    phase: "observe",
    from: "Ready for Containment",
    to: "Analyzing",
  });
  trace.push({
    phase: "observe",
    title: "Observe signal",
    detail: `Read complaint ${signal?.id ?? c.signal_id}: "${signal?.summary ?? c.title}" (severity ${c.severity}, confidence ${c.confidence.toFixed(2)}).`,
  });

  // map lot -> sku/warehouse
  trace.push({
    phase: "map",
    title: "Map lot / SKU / warehouse",
    detail: `Lot ${c.lot} maps to ${c.sku} in warehouse ${c.warehouse}.`,
  });
  addTimeline(c.id, "Batch Containment Agent", "Tool: lot mapping", `Lot ${c.lot} → ${c.sku} @ ${c.warehouse}`, {
    phase: "tool",
  });

  // fan out: candidate orders for this lot
  const lotOrders = getOrdersByLot(c.lot);
  const rows: Omit<CaseOrderRow, "id">[] = [];
  const eligible: OrderRow[] = [];
  for (const o of lotOrders) {
    if (o.warehouse !== c.warehouse) {
      rows.push(excludedRow(c, o, `Outside declared scope (warehouse ${o.warehouse})`));
    } else if (o.status !== "Ready to Ship") {
      rows.push(excludedRow(c, o, `Ineligible status: ${o.status}`));
    } else {
      eligible.push(o);
    }
  }
  trace.push({
    phase: "fanout",
    title: "Fan out affected orders",
    detail: `Found ${eligible.length} eligible Ready to Ship orders for lot ${c.lot} in ${c.warehouse}.`,
  });
  addTimeline(c.id, "Batch Containment Agent", "Tool: order fan-out", `${eligible.length} eligible orders, ${rows.length} excluded`, {
    phase: "tool",
  });

  const decision = decidePlan(c.confidence, c.severity, eligible.length);

  // Optional model narration (additive)
  let modelNote: string | null = null;
  try {
    modelNote = await narrate(
      `Complaint: ${signal?.summary}. Lot ${c.lot}, SKU ${c.sku}, warehouse ${c.warehouse}. Severity ${c.severity}, confidence ${c.confidence}. Eligible Ready-to-Ship orders: ${eligible.length}. Policy decision: ${decision.plan}. Threshold 0.70.`,
    );
  } catch {
    modelNote = null;
  }

  if (decision.plan === "full_stop") {
    for (const o of eligible) rows.push(includedRow(c, o, "Lot, warehouse, and Ready to Ship status match the safety signal."));
  } else if (decision.plan === "human_review") {
    // partial scope = the single zone with the most candidates
    const byZone = new Map<string, typeof eligible>();
    for (const o of eligible) {
      const arr = byZone.get(o.zone) ?? [];
      arr.push(o);
      byZone.set(o.zone, arr);
    }
    const topZone = [...byZone.entries()].sort((a, b) => b[1].length - a[1].length)[0]?.[0];
    for (const o of eligible) {
      if (o.zone === topZone) {
        rows.push(includedRow(c, o, `Partial scope: highest-confidence zone ${o.zone}.`));
      } else {
        rows.push({ ...candidateRow(c, o, "Deferred — lot confidence below full-stop threshold."), included: 0 });
      }
    }
  } else {
    for (const o of eligible) rows.push({ ...candidateRow(c, o, "Monitor only — below action threshold."), included: 0 });
  }

  replaceCaseOrders(c.id, rows);
  const included = rows.filter((r) => r.included === 1);
  const includedCodes = included.map((r) => r.order_code);
  const excludedCount = rows.length - included.length;
  const scopeHash = scopeHashOf(includedCodes);
  setCasePlanScope(c.id, decision.plan, scopeHash, included.length, excludedCount);

  const cref = runRef("containment", caseCode);
  addGovernedRun(c.id, "containment", mode, cref, "completed", `plan=${decision.plan}`);
  if (mode === "cloud" && process.env.UIPATH_PROCESS_KEY_CONTAINMENT) {
    // best-effort governed process start; never blocks the demo path
    void startCloudProcess(process.env.UIPATH_PROCESS_KEY_CONTAINMENT, { caseCode, lot: c.lot });
  }

  trace.push({
    phase: "plan",
    title: "Plan containment",
    detail: (modelNote ? modelNote + " " : "") + decision.rationale,
  });

  if (decision.plan === "full_stop") {
    updateCaseStatus(c.id, "Awaiting QA Approval");
    addTimeline(c.id, "Batch Containment Agent", "Proposed full stop-ship", `${included.length} orders proposed for quarantine, pending QA approval.`, {
      phase: "plan",
      from: "Analyzing",
      to: "Awaiting QA Approval",
    });
    trace.push({
      phase: "approval",
      title: "Prepare QA approval",
      detail: `Created an approval checkpoint for ${included.length} orders. No state has changed yet.`,
    });
  } else if (decision.plan === "human_review") {
    updateCaseStatus(c.id, "Human Review Required");
    addEvidenceTask(
      c.id,
      "Review customer photos and thermal logs",
      "Compare submitted evidence against threshold criteria to confirm or rule out the suspected lot.",
    );
    addTimeline(c.id, "Batch Containment Agent", "Routed to human review", `Confidence ${c.confidence.toFixed(2)} below threshold; partial scope (${included.length}) proposed and an evidence task queued.`, {
      phase: "plan",
      from: "Analyzing",
      to: "Human Review Required",
    });
    trace.push({
      phase: "approval",
      title: "Route to human review",
      detail: `Lot confidence is below the full-stop threshold. Proposed a partial hold of ${included.length} orders and queued one evidence task.`,
    });
  } else {
    updateCaseStatus(c.id, "No Containment Needed");
    addTimeline(c.id, "Batch Containment Agent", "No containment needed", "No eligible orders or confidence below monitor floor.", {
      phase: "plan",
      from: "Analyzing",
      to: "No Containment Needed",
    });
  }

  // Real UiPath Action Center governed human task on the approval checkpoint (cloud mode, robot-free).
  if (mode === "cloud" && (decision.plan === "full_stop" || decision.plan === "human_review")) {
    const task = await createApprovalTask({
      caseCode,
      title: `Red Batch — ${decision.plan === "full_stop" ? "Approve stop-ship" : "Human review"} for lot ${c.lot} (${included.length} orders)`,
      priority: c.severity === "Critical" || c.severity === "High" ? "High" : "Medium",
      data: {
        caseCode,
        lot: c.lot,
        sku: c.sku,
        warehouse: c.warehouse,
        severity: c.severity,
        confidence: c.confidence,
        affected: included.length,
        excluded: excludedCount,
        plan: decision.plan,
        decisionRequired: "approve_full | approve_partial | request_evidence | reject",
      },
    });
    if (task.ok) {
      addGovernedRun(c.id, "approval_task", mode, task.ref, "pending", task.url ?? "Action Center external task");
      addTimeline(c.id, "Batch Containment Agent", "UiPath approval task created", `Action Center task ${task.ref} opened for the QA human checkpoint.`, {
        phase: "approval",
      });
      trace.push({
        phase: "approval",
        title: "Open UiPath approval task",
        detail: `Created a real UiPath Action Center task (${task.ref}) for the human decision. No state has changed yet.`,
      });
    }
  }

  const updated = getCase(caseCode)!;
  return {
    ok: true,
    alreadyRun: false,
    caseCode,
    status: updated.status,
    plan: decision.plan,
    rationale: decision.rationale,
    includedCount: included.length,
    excludedCount,
    trace,
  };
}

export interface ApproveInput {
  role: string;
  name: string;
  decision: ApprovalDecision;
  reason?: string;
}

export interface ApproveResult {
  ok: true;
  status: string;
  packetCode?: string;
  expected: number;
  changed: number;
  failed: number;
}

export async function approveAndExecute(caseCode: string, input: ApproveInput): Promise<ApproveResult> {
  const c = getCase(caseCode);
  if (!c) throw Object.assign(new Error("Case not found"), { code: 404 });

  if (input.decision === "request_evidence") {
    addEvidenceTask(c.id, "Additional evidence requested", input.reason || "QA requested more evidence before any hold.");
    addApproval(c.id, input.role, input.name, "request_evidence", input.reason ?? null, c.affected_count, c.scope_hash ?? "");
    updateCaseStatus(c.id, "Evidence Requested");
    addTimeline(c.id, `${input.name} (${input.role})`, "Requested more evidence", input.reason || "More evidence requested before any stop-ship.", {
      phase: "approval",
      from: c.status as CaseRow["status"],
      to: "Evidence Requested",
    });
    return { ok: true, status: "Evidence Requested", expected: 0, changed: 0, failed: 0 };
  }

  if (input.decision === "reject") {
    addApproval(c.id, input.role, input.name, "reject", input.reason ?? null, c.affected_count, c.scope_hash ?? "");
    updateCaseStatus(c.id, "Evidence Requested");
    addTimeline(c.id, `${input.name} (${input.role})`, "Rejected hold", input.reason || "Hold rejected; no orders mutated.", {
      phase: "approval",
      from: c.status as CaseRow["status"],
      to: "Evidence Requested",
    });
    return { ok: true, status: "Evidence Requested", expected: 0, changed: 0, failed: 0 };
  }

  // approve_full | approve_partial
  if (c.status !== "Awaiting QA Approval" && c.status !== "Human Review Required") {
    throw Object.assign(new Error(`Case is not awaiting approval (status: ${c.status}).`), { code: 409 });
  }

  const included = getCaseOrders(c.id).filter((r) => r.included === 1);
  const currentHash = scopeHashOf(included.map((r) => r.order_code));
  if (c.scope_hash && currentHash !== c.scope_hash) {
    throw Object.assign(new Error("Affected-order scope changed since analysis. Re-run containment before approval."), {
      code: 409,
    });
  }

  const mode = uipathMode();
  addApproval(c.id, input.role, input.name, input.decision, input.reason ?? null, included.length, currentHash);
  addTimeline(c.id, `${input.name} (${input.role})`, "QA approved stop-ship", `Approved quarantine of ${included.length} orders. Governance gate passed.`, {
    phase: "approval",
    from: c.status as CaseRow["status"],
    to: "Mutating Orders",
  });

  // Close the real UiPath Action Center approval task with the human decision (cloud mode).
  if (mode === "cloud") {
    const taskRun = getGovernedRuns(c.id)
      .filter((g) => g.kind === "approval_task" && g.status === "pending")
      .pop();
    const tid = taskRun?.run_ref.match(/UIPATH-TASK-(\d+)/)?.[1];
    if (taskRun && tid) {
      const done = await completeApprovalTask(Number(tid), input.decision, {
        approver: input.name,
        role: input.role,
        reason: input.reason ?? "",
        approvedCount: included.length,
      });
      if (done.ok) {
        updateGovernedRunByRef(c.id, taskRun.run_ref, "completed", taskRun.detail);
        addTimeline(c.id, `${input.name} (${input.role})`, "UiPath approval task completed", `Action Center task ${taskRun.run_ref} closed with decision ${input.decision}.`, {
          phase: "approval",
        });
      }
    }
  }

  updateCaseStatus(c.id, "Mutating Orders");
  const mref = runRef("order_mutation", caseCode);
  addGovernedRun(c.id, "order_mutation", mode, mref, "running", `${included.length} orders`);
  if (mode === "cloud" && process.env.UIPATH_PROCESS_KEY_ORDER_MUTATION) {
    void startCloudProcess(process.env.UIPATH_PROCESS_KEY_ORDER_MUTATION, {
      caseCode,
      orders: included.map((r) => r.order_code),
    });
  }

  // real persisted mutation
  const quarantine = (process.env.ORDER_QUARANTINE_STATUS as "Quarantined - QA Review") || "Quarantined - QA Review";
  for (const r of included) {
    updateOrderStatus(r.order_id, quarantine);
    setCaseOrderResult(r.id, quarantine, "changed", 0);
  }

  // verify via readback
  updateCaseStatus(c.id, "Verifying");
  let changed = 0;
  let failed = 0;
  for (const r of included) {
    const o = getOrderByCode(r.order_code);
    if (o && o.status === quarantine) {
      setCaseOrderResult(r.id, quarantine, "changed", 1);
      changed++;
    } else {
      setCaseOrderResult(r.id, (o?.status as CaseOrderRow["final_status"]) ?? null, "failed", 0);
      failed++;
    }
  }
  const expected = included.length;
  addGovernedRun(c.id, "verification", mode, runRef("verification", caseCode), failed === 0 ? "verified" : "partial", `${changed}/${expected} verified`);
  addTimeline(c.id, "Batch Containment Agent", "Verified mutation", `${changed} of ${expected} orders verified as ${quarantine}.`, {
    phase: "verify",
    from: "Mutating Orders",
    to: failed === 0 ? "Verified" : "Mutation Exception",
  });

  const packetCode = packetCodeFor(caseCode);
  if (failed === 0) {
    updateCaseStatus(c.id, "Verified");
    const summary = buildPacketSummary(caseCode, packetCode, input);
    createPacket(c.id, packetCode, "Final", summary);
    setCasePacket(c.id, packetCode);
    addGovernedRun(c.id, "packet", mode, runRef("packet", caseCode), "final", packetCode);
    addTimeline(c.id, "Batch Containment Agent", "Stop-Ship Packet saved", `Packet ${packetCode} created after verification.`, {
      phase: "packet",
      from: "Verified",
      to: "Packet Saved",
    });
    updateCaseStatus(c.id, "Packet Saved");
    return { ok: true, status: "Packet Saved", packetCode, expected, changed, failed };
  }

  updateCaseStatus(c.id, "Mutation Exception");
  const summary = buildPacketSummary(caseCode, packetCode, input);
  createPacket(c.id, packetCode, "Pending", summary);
  setCasePacket(c.id, packetCode);
  addTimeline(c.id, "Batch Containment Agent", "Mutation exception", `${failed} orders failed verification; packet held as Pending.`, {
    phase: "packet",
    from: "Mutation Exception",
    to: "Mutation Exception",
  });
  return { ok: true, status: "Mutation Exception", packetCode, expected, changed, failed };
}

function buildPacketSummary(caseCode: string, packetCode: string, input: ApproveInput) {
  const c = getCase(caseCode)!;
  const signal = getSignal(c.id);
  const orders = getCaseOrders(c.id);
  const included = orders.filter((r) => r.included === 1);
  const excluded = orders.filter((r) => r.included !== 1);
  const valueCents = included.reduce((s, r) => s + (r.value_cents || 0), 0);
  return {
    packetCode,
    caseCode,
    title: c.title,
    outcome: `${included.length} orders quarantined for QA review`,
    verifiedAt: new Date().toISOString(),
    approver: { name: input.name, role: input.role },
    scope: { lot: c.lot, sku: c.sku, warehouse: c.warehouse, severity: c.severity, confidence: c.confidence },
    signal: signal ? { id: signal.id, summary: signal.summary, source: signal.source, receivedAt: signal.received_at } : null,
    evidence: getEvidence(c.id).map((e) => ({ kind: e.kind, label: e.label, detail: e.detail })),
    diff: { before: "Ready to Ship", after: "Quarantined - QA Review", count: included.length },
    verification: { expected: included.length, changed: included.filter((r) => r.mutation_result === "changed").length },
    exclusions: excluded.map((r) => ({ order: r.order_code, reason: r.reason, status: r.before_status })),
    valueCents,
  };
}

/* row builders */
function includedRow(c: CaseRow, o: OrderRow, reason: string): Omit<CaseOrderRow, "id"> {
  return {
    case_id: c.id,
    order_id: o.id,
    order_code: o.code,
    before_status: o.status,
    proposed_status: "Quarantined - QA Review",
    final_status: null,
    included: 1,
    reason,
    mutation_result: "pending",
    verified: 0,
    zone: o.zone,
    value_cents: o.value_cents,
  };
}
function candidateRow(c: CaseRow, o: OrderRow, reason: string): Omit<CaseOrderRow, "id"> {
  return {
    case_id: c.id,
    order_id: o.id,
    order_code: o.code,
    before_status: o.status,
    proposed_status: "Quarantined - QA Review",
    final_status: null,
    included: 1,
    reason,
    mutation_result: "pending",
    verified: 0,
    zone: o.zone,
    value_cents: o.value_cents,
  };
}
function excludedRow(c: CaseRow, o: OrderRow, reason: string): Omit<CaseOrderRow, "id"> {
  return {
    case_id: c.id,
    order_id: o.id,
    order_code: o.code,
    before_status: o.status,
    proposed_status: o.status,
    final_status: o.status,
    included: 0,
    reason,
    mutation_result: "excluded",
    verified: 0,
    zone: o.zone,
    value_cents: o.value_cents,
  };
}
